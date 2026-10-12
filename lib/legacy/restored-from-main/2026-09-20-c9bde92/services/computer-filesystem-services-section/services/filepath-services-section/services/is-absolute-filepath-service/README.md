# @red-cup-engineering/is-absolute-filepath-service

Reports whether one filepath spelling is absolute on this platform, without observing the filesystem.

## Operation

~~~js
export function isAbsoluteFilepath(path)
~~~

### Parameters

- path (string): A filepath spelling.

### Returns

boolean: Whether the spelling is absolute.

### Refusals

- TypeError: When path is not a string.

## Command

is-absolute-filepath reads one JSON value per input line and writes one JSON value per output line.

## Examples

### is-absolute-filepath example

Input:

~~~json
"/x/y"
~~~

Output:

~~~json
true
~~~
