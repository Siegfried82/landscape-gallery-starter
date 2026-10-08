import {validatedPreviewBytes} from './display';
/** Validate all JPEG segments and remove metadata without decoding pixels. */
export function heroBytes(file:File){return validatedPreviewBytes(file,16*1024*1024,12_000_000,65535);}
