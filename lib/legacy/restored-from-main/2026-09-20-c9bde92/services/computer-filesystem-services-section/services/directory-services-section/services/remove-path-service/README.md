# @red-cup-engineering/remove-path-service

Removes one file or directory tree at a path, and reports the path removed; an absent path is not an error.

## Operation

~~~js
export async function removePath(request)
~~~

### Parameters

- request (object): A record with the path to remove.

### Returns

Promise<object>: A PathRemoved record.

### Refusals

- TypeError: When path is not a non-empty string.

## Command

remove-path reads one JSON value per input line and writes one JSON value per output line.

## Examples

### remove-path example

Input:

~~~json
{
  "path": "/tmp/561-group-remove-path-example-absent"
}
~~~

Output:

~~~json
{
  "type": "PathRemoved",
  "path": "/tmp/561-group-remove-path-example-absent"
}
~~~
