import * as cdk from '@aws-cdk/core';
import * as codecommit from '@aws-cdk/aws-codecommit';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as lambda from '@aws-cdk/aws-lambda';
import * as iam from '@aws-cdk/aws-iam';

export class CdkCfnpipelineStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    
    // --- vars ---
    const stageStackName = 'webAppInfraSTAGE'
    const prodStackName = 'webAppInfraPROD'

    const stageChangeSetName = 'STAGEChangeSet'
    const prodChangeSetName = 'PRODChangeSet'

    // --- test lambdas ---
    const integLambda = new lambda.Function(this, 'integLambda', {
      runtime: lambda.Runtime.PYTHON_3_8,
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset('lambdas'),
    });

    integLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['logs:*'],
      resources: ['arn:aws:logs:*:*:*']
    }));

    integLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['codepipeline:PutJobSuccessResult','codepipeline:PutJobFailureResult'],
      resources: ['*']
    }));
                            
    integLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['cloudformation:DescribeStacks'],
      resources: ['*']
    }));

    // --- repository ---
    const repo = new codecommit.Repository(this, 'myCfnRepo', {
      repositoryName: 'webapp-infra'
    });

    // --- pipeline ---
    const pipeline = new codepipeline.Pipeline(this, 'myCfnPipeline', {
      pipelineName: 'webapp-infra-cd'
    });

    // --- source stage and action ---
    const sourceOutput = new codepipeline.Artifact();
    const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
      actionName: 'CodeCommit',
      repository: repo,
      branch: 'main',
      output: sourceOutput,
    });

    pipeline.addStage({
      stageName: 'Source',
      actions: [sourceAction],
    });

    // --- build stage and actions ---
    const buildOutput = new codepipeline.Artifact();
    const buildProject = new codebuild.PipelineProject(this, 'myCfnBuild');

    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'CodeBuild',
      project: buildProject,
      input: sourceOutput,
      outputs: [buildOutput],
    });

    pipeline.addStage({
      stageName: 'Build',
      actions: [buildAction],
    });

    // --- test stage and actions ---

    const prepTestChanges = new codepipeline_actions.CloudFormationCreateReplaceChangeSetAction({
      actionName: 'PrepTestChanges',
      stackName: stageStackName,
      changeSetName: stageChangeSetName,
      adminPermissions: true,
      parameterOverrides: {
        "Environment": "STAGING",
        "MinSize": "1",
        "MaxSize": "2",
        "InstanceType": "t2.micro"
      },
      templatePath: buildOutput.atPath('template.yml'),
      templateConfiguration: buildOutput.atPath('template-config.json'),
      runOrder: 1,
    });
    
    const executeTestChanges = new codepipeline_actions.CloudFormationExecuteChangeSetAction({
      actionName: 'ExecuteTestChanges',
      stackName: stageStackName,
      changeSetName: stageChangeSetName,
      runOrder: 2,
    });

    const lambdaTest = new codepipeline_actions.LambdaInvokeAction({
      actionName: 'lambdaIntegTest', 
      lambda: integLambda,
      userParameters: [stageStackName],
      runOrder: 3,
    });

    pipeline.addStage({
      stageName: 'Test',
      actions: [ prepTestChanges, executeTestChanges, lambdaTest],
    });

    // --- deploy stage and actions ---
    const prepChanges = new codepipeline_actions.CloudFormationCreateReplaceChangeSetAction({
      actionName: 'PrepChanges',
      stackName: prodStackName,
      changeSetName: prodChangeSetName,
      adminPermissions: true,
      templatePath: buildOutput.atPath('template.yml'),
      templateConfiguration: buildOutput.atPath('template-config.json'),
      runOrder: 1,
    });
    
    const approveChanges = new codepipeline_actions.ManualApprovalAction({
      actionName: 'ManualApproval',
      runOrder: 2
    });

    const executeChanges = new codepipeline_actions.CloudFormationExecuteChangeSetAction({
      actionName: 'ExecuteChanges',
      stackName: prodStackName,
      changeSetName: prodChangeSetName,
      runOrder: 3,
    });

    pipeline.addStage({
      stageName: 'Deploy',
      actions: [ prepChanges, approveChanges, executeChanges],
    });

  }
}
