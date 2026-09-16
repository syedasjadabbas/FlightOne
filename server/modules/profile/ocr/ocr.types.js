/**
 * @typedef {object} OcrIdentityFields
 * @property {string} [documentNumber]
 * @property {string} [countryCode]
 * @property {string} [documentSubtype]
 * @property {string} [issuedAt]
 * @property {string} [expiresAt]
 * @property {string} [fullName]
 * @property {string} [nationality]
 */

/**
 * @typedef {object} OcrExtractionResult
 * @property {string} provider
 * @property {OcrIdentityFields} fields
 * @property {number|null} confidence
 * @property {string[]} warnings
 * @property {string|null} rawTextEcho
 */

/**
 * @typedef {object} OcrProvider
 * @property {string} name
 * @property {(args: {
 *   documentType: string,
 *   vaultDocumentId?: string|null,
 *   contentType?: string|null,
 *   byteSize?: number|null,
 *   hasBinary?: boolean,
 *   contentBase64?: string|null,
 *   rawText?: string|null,
 * }) => Promise<OcrExtractionResult>} extract
 */

export {};
