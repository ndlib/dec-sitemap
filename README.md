# DEC Sitemap Generator

This is a primitive tool to generate a sitemap for https://collections.library.nd.edu.

## Requirements

* node
* yarn

## Installation

`yarn install`

## Usage

***WARNING:*** *This makes tons of calls to honeycomb and can impact user experience. Either change the path to honeycomb
or modify the script to only fetch one collection, unless you need to generate a new sitemap for uploading to Google.*

* `node generate_sitemap.js`
* Wait for the script to complete.
* Collect output from sitemap folder.