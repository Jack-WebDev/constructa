# Constructa API

Future public API for remote generation, saved generators, API keys, usage limits, and integrations.

This scaffold deliberately does not select a server framework, database, or deployment platform. Those decisions should follow the generator engine and persistence model. API handlers will consume `@constructa/sdk`; generator behavior must not be reimplemented here.

The API may depend on `@constructa/sdk` and `@constructa/env`. It must use SDK public exports rather than importing core, generators, exporters, schema, or another application directly.
