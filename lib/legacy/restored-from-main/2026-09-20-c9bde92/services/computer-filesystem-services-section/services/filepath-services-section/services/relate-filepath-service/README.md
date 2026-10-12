# @red-cup-engineering/relate-filepath-service

Projects the relative filepath spelling from one path to another, without observing the filesystem.

## Operation

~~~js
export function relateFilepath(request)
~~~

### Parameters

- request (object): A record with from and to filepath spellings.

### Returns

string: The relative path from from to to.

### Refusals

- TypeError: When from or to is not a string.

## Command

relate-filepath reads one JSON value per input line and writes one JSON value per output line.

## Examples

### relate-filepath example

Input:

~~~json
{
  "from": "/a/b",
  "to": "/a/c/d"
}
~~~

Output:

~~~json
"../c/d"
~~~
