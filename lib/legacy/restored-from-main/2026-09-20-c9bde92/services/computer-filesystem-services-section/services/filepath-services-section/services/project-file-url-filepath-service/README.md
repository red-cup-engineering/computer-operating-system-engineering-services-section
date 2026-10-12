# @red-cup-engineering/project-file-url-filepath-service

Projects one file: URL spelling, such as a module's import.meta.url, to the platform filepath it names.

## Operation

~~~js
export function projectFileUrlFilepath(url)
~~~

### Parameters

- url (string): A file: URL string.

### Returns

string: The platform filepath the URL names.

### Refusals

- TypeError: When url is not a string beginning with file:.

## Command

project-file-url-filepath reads one JSON value per input line and writes one JSON value per output line.

## Examples

### projects a file URL

Input:

~~~json
"file:///tmp/a%20b/c.mjs"
~~~

Output:

~~~json
"/tmp/a b/c.mjs"
~~~
