#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CdkCfnpipelineStack } from '../lib/cdk-cfnpipeline-stack';

const app = new cdk.App();
new CdkCfnpipelineStack(app, 'CdkCfnpipelineStack');
