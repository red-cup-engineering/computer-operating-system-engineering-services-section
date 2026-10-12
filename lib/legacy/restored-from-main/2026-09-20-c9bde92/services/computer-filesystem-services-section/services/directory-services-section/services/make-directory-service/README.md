# @red-cup-engineering/make-directory-service

Makes one directory and every missing ancestor, and reports the path made.

## Operation

~~~js
export async function makeDirectory(request)
~~~

### Parameters

- request (object): A record with the directory path.

### Returns

Promise<object>: A DirectoryMade record.

### Refusals

- TypeError: When path is not a non-empty string.

## Command

make-directory reads one JSON value per input line and writes one JSON value per output line.

## Examples

### make-directory example

Input:

~~~json
{
  "path": "/tmp/561-group-make-directory-example"
}
~~~

Output:

~~~json
{
  "type": "DirectoryMade",
  "path": "/tmp/561-group-make-directory-example"
}
~~~
