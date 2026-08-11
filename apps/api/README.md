# Constructa API

The **Constructa API** will provide the public HTTP API for Constructa, enabling remote generation, saved generators, API key management, usage limits, and third-party integrations.

This package intentionally does not prescribe a server framework, database, or deployment platform. Those architectural decisions should be made once the generator engine and persistence model are sufficiently defined.

## Architecture

API handlers should act as a thin interface between external consumers and the Constructa SDK.

All generator functionality must be accessed through the public API exposed by `constructa-sdk`. Generator behavior, validation, execution logic, and other domain functionality must **not** be reimplemented within the API.

The API may depend directly on:

* `constructa-sdk`
* `constructa-env`

It must **not** import directly from lower-level Constructa packages such as:

* `constructa-core`
* `constructa-generators`
* `constructa-exporters`
* `constructa-schema`
* Other Constructa applications

This boundary ensures that `constructa-sdk` remains the supported programmatic interface to the Constructa platform while the API remains focused on transport-level concerns such as HTTP handling, authentication, authorization, rate limiting, and request/response serialization.
