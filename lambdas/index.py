from __future__ import print_function
from boto3.session import Session


import json
import urllib
import boto3
import botocore
import traceback
import urllib3

code_pipeline = boto3.client('codepipeline')

def put_job_success(job, message):
    """Notify CodePipeline of a successful job
    
    Args:
        job: The CodePipeline job ID
        message: A message to be logged relating to the job status
        
    Raises:
        Exception: Any exception thrown by .put_job_success_result()
    
    """
    print('Putting job success')
    print(message)
    code_pipeline.put_job_success_result(jobId=job)
  
def put_job_failure(job, message):
    """Notify CodePipeline of a failed job
    
    Args:
        job: The CodePipeline job ID
        message: A message to be logged relating to the job status
        
    Raises:
        Exception: Any exception thrown by .put_job_failure_result()
    
    """
    print('Putting job failure')
    print(message)
    code_pipeline.put_job_failure_result(jobId=job, failureDetails={'message': message, 'type': 'JobFailed'})
def lambda_handler(event, context):
    
    try:
        cf_client = boto3.client('cloudformation')
        url = ""

        job_id = event['CodePipeline.job']['id']
        job_data = event['CodePipeline.job']['data']

        stack_name = json.loads(job_data['actionConfiguration']['configuration']['UserParameters'])
        response = cf_client.describe_stacks(StackName=stack_name[0])
        outputs = response["Stacks"][0]["Outputs"]

        for output in outputs:
            if output["OutputKey"] == 'URL':
                print(output["OutputValue"])
                url = output["OutputValue"]

        # --- request ---
        http = urllib3.PoolManager()
        r = http.request('GET', url)

        if r.status == 200:
            message = 'The deployment was succesfull, the website is reachable'
            put_job_success(job_id, message)
        else:
            message = 'The deployment was not succesfull the website is NOT reachable'
            put_job_failure(job_id, message)

    except Exception as e:
        print('Function failed due to exception')
        print(e)
        traceback.print_exc()

    print('Function Complete')
    return "Complete"
