'use strict'

// Serverless v2.10.0 introduced breaking changes
// https://github.com/serverless/serverless/pull/8460/commits/cdba0ac11d4276b13bc4a764e99278417ff25c9a
const deploymentBucketProperty = (version) => {
  const semVerParts = version.split('.')
  const major = parseInt(semVerParts[0], 10)
  const minor = parseInt(semVerParts[1], 10)
  return major > 2 || (major == 2 && minor > 9) ?
    'deploymentBucket' :
    'deploymentBucketObject'
}

module.exports = {deploymentBucketProperty}
