'use strict'

const filterValidBucketTags = (input) => {
  const output = (Array.isArray(input) ? input : []).reduce((tags, tag) => {
    if (typeof tag === 'object' && typeof tag.Key === 'string' && typeof tag.Value === 'string') {
      const { Key, Value } = tag;
      tags.push({ Key, Value });
    }
    return tags;
  }, []);
  return output.length ? output : undefined;
}

module.exports = {
  filterValidBucketTags
}
