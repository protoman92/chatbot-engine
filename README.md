# chatbot-engine

Experimental chatbot engine to build cross-platform chatbots.

## Sequence of response selection

### Receive platform request

Request is received from a supported platform, and mapped to an `Array` of `GenericRequest`. A `GenericRequest` contains the `senderID`, `oldContext` and supported data.

### Feed generic request to leaf selector

A `LeafSelector` scans through all leaves and picks out the one whose conditions match the request input. It does so by creating a `LeafPipeline` for each `Leaf` - each pipeline checks its associated `Leaf`'s conditions, mutating the input `Context` to an output `Context` and produce `Leaf` content.

### Map generic responses and send the resulting responses back

The resulting `GenericResponse` instances are then mapped to the payload specified by supported platforms, then sent back to the user.
