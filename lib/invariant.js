/* dsh-codex-connect-plus: modified derivative; Copyright 2026 0751; Apache-2.0, see NOTICE and THIRD_PARTY_NOTICES.md. */
//#region src/invariant.ts
const PACKAGE_NAME = "dsh-codex-connect-plus";
/** Cordis companion plugin name. */
const name = "openai-codex-invariant";
/** Service required before the companion can register. */
const inject = ["invariants"];
const install = () => {};
/**
* Register this package's invariant companion.
* @param ctx - Cordis context carrying the invariant service.
* @returns the installed registration's disposer after setup succeeds.
*/
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
