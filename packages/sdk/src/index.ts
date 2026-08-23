/**
 * The supported developer-facing Constructa API.
 *
 * This facade exposes the execution engine and built-in generator factories
 * from one stable module path. Core's public schema types are re-exported by
 * the engine; use `@constructa/schema` directly for document parsing helpers.
 */
export * from "constructa-core";
export * from "constructa-generators";
