# serverless-deployment-bucket

[![NPM Downloads](https://img.shields.io/npm/dt/serverless-deployment-bucket)](https://www.npmjs.com/package/serverless-deployment-bucket) [![Build Status](https://travis-ci.org/MikeSouza/serverless-deployment-bucket.svg?branch=master)](https://travis-ci.org/MikeSouza/serverless-deployment-bucket)
[![Coverage Status](https://coveralls.io/repos/github/MikeSouza/serverless-deployment-bucket/badge.svg?branch=master)](https://coveralls.io/github/MikeSouza/serverless-deployment-bucket?branch=master)

Create and configure the custom Serverless deployment bucket.

## Purpose

By default, [Serverless](https://serverless.com) creates a bucket with a generated name like `<service name>-serverlessdeploymentbuck-1x6jug5lzfnl7` to store your service's stack state. This can lead to many old deployment buckets laying around in your AWS account and your service having more than one bucket created (only one bucket is actually used).

Serverless' AWS provider can be configured to customize aspects of the [deployment bucket](https://serverless.com/framework/docs/providers/aws/guide/serverless.yml), such as specifying server-side encryption and a custom deployment bucket name. However, server-side encryption is only applied to the objects that Serverless puts into the bucket and is not applied on the bucket itself. Furthermore, if the bucket name you specify doesn't exist, you will encounter an error like:

```text
Serverless Error ---------------------------------------

  Could not locate deployment bucket. Error: The specified bucket does not exist
```

This plugin will create your custom deployment bucket if it doesn't exist, and optionally configure the deployment bucket to apply server-side encryption by default on objects, regardless of whether the bucket was created by this plugin and as long as you configure the provider with `serverSideEncryption: AES256`.

This plugin also provides the optional ability to enable versioning of bucket objects, however this is not enabled by default since Serverless tends to keep its own copies and versions of state.

## Install

`npm install serverless-deployment-bucket --save-dev`

## Configuration

Add the plugin to your `serverless.yml`:

```yaml
plugins:
  - serverless-deployment-bucket
```

Configure the AWS provider to use a custom deployment bucket:

```yaml
provider:
  deploymentBucket:
    name: your-custom-deployment-bucket
    serverSideEncryption: AES256
```

Optionally add custom configuration properties:

```yaml
custom:
  deploymentBucket:
    versioning: true
    accelerate: true
```

| Property     | Required | Type      | Default | Description                                  |
|--------------|----------|-----------|---------|----------------------------------------------|
| `versioning` |  `false` | `boolean` | `false` | Enable versioning on the deployment bucket   |
| `accelerate` |  `false` | `boolean` | `false` | Enable acceleration on the deployment bucket |
| `enabled`    |  `false` | `boolean` | `true`  | Enable this plugin                           |
| `policy`     |  `false` | `string`  |         | Bucket policy as JSON                        |

## Usage

Configuration of your `serverless.yml` is all you need.

There are no custom commands, just run: `sls deploy`
