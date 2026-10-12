# @red-cup-engineering/project-filepath-extension-service

Projects one filepath spelling to its final extension, including the dot, or the empty string when it has none, without observing the filesystem.

## Operation

~~~js
export function projectFilepathExtension(path)
~~~

### Parameters

- path (string): A filepath spelling.

### Returns

string: The extension including its dot, or the empty string.

### Refusals

- TypeError: When path is not a string.

## Command

project-filepath-extension reads one JSON value per input line and writes one JSON value per output line.

## Examples

### project-filepath-extension example

Input:

~~~json
"a/b.tar.gz"
~~~

Output:

~~~json
".gz"
~~~
