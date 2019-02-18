# serverless-deployment-bucket

Create and configure the custom Serverless deployment bucket.

This plugin will create the S3 deployment bucket you've specified in your provider configuration if it doesn't exist.
It will also correctly apply default SSE encryption to the bucket, whereas Serverless only applies SSE to the files it creates in the bucket if you specify a custom deployment bucket.
An option is provided to apply versioning to the deployment bucket as well.

## Usage

Add plugin to your `serverless.yml`:

```yaml
plugins:
  - serverless-deployment-bucket
```

Configure the provider to use a custom deployment bucket in your `serverless.yaml`:

```yaml
provider:
  deploymentBucket:
    name: your-custom-deployment-bucket
    serverSideEncryption: AES256
```

Add custom configuration to your `serverless.yml`:

```yaml
custom:
  deploymentBucket:
    versioning: true
```

| Property     | Required | Type      | Default | Description                                |
|--------------|----------|-----------|---------|--------------------------------------------|
| `versioning` |  `false` | `boolean` | `false` | Enable versioning on the deployment bucket |
