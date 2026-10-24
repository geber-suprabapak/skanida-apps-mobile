/**
 * Pure validation and request-construction rules for the Leave Request form
 * (`app/perizinan/izin.tsx`). Extracted so the optional-attachment rule and
 * input boundaries can be tested without mounting the screen.
 *
 * Domain rule (CONTEXT.md): the Leave Request attachment is optional; its
 * absence does not invalidate the Leave Request. Validation still applies to
 * category/description and to an attachment when a file is actually present.
 */

export type PermitCategory = "sakit" | "pergi";

export interface LeaveFormImage {
  uri: string;
  fileSize: number;
}

export interface LeaveFormValues {
  category: PermitCategory;
  description: string;
  image: LeaveFormImage | null;
}

export interface LeaveFormValidation {
  category: boolean;
  description: boolean;
  /** True when no attachment is selected (optional) or the selected file is valid. */
  attachment: boolean;
  valid: boolean;
}

export const MIN_DESCRIPTION_LENGTH = 10;
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
export const IMAGE_FORMAT = "jpeg";

export interface PickedImageAsset {
  uri: string;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
}

export interface PickedImageResult {
  canceled?: boolean;
  assets?: PickedImageAsset[] | null;
}

/**
 * Returns the first picked asset, or null when the picker was cancelled or
 * returned no usable asset. A cancelled pick must leave the form unchanged so
 * an attachment-less Leave Request remains submittable.
 */
export function resolvePickedAsset<
  A extends PickedImageAsset = PickedImageAsset,
>(
  result: { canceled?: boolean; assets?: A[] | null } | null | undefined,
): A | null {
  if (!result || result.canceled) return null;
  if (!Array.isArray(result.assets) || result.assets.length === 0) return null;
  return result.assets[0] ?? null;
}

/**
 * Attachment validation for a file that is actually present: the size must be
 * a finite, non-negative value within the 10 MB limit. Absence is handled by
 * the caller (the attachment is optional).
 */
export function isValidLeaveImageSize(size: number): boolean {
  return Number.isFinite(size) && size >= 0 && size <= MAX_IMAGE_SIZE_BYTES;
}

export function validateLeaveForm(
  values: LeaveFormValues,
): LeaveFormValidation {
  const category = values.category === "sakit" || values.category === "pergi";
  const description =
    values.description.trim().length >= MIN_DESCRIPTION_LENGTH;
  const attachment =
    values.image === null
      ? true
      : Boolean(values.image.uri) &&
        isValidLeaveImageSize(values.image.fileSize);

  return {
    category,
    description,
    attachment,
    valid: category && description && attachment,
  };
}

export const getImageContentType = (uri: string): string => {
  const ext = uri.split(".").pop()?.toLowerCase();
  return ext === "png" ? "image/png" : "image/jpeg";
};

export interface PermitFilePart {
  uri: string;
  name: string;
  type: string;
}

/**
 * Builds the optional multipart file part for `createPermit`. Returns
 * undefined when no image is selected so the multipart body omits the
 * `attachment` field entirely (see `utils/bffMobileApi.ts#createPermit`).
 */
export function buildPermitAttachment(
  image: LeaveFormImage | null,
): PermitFilePart | undefined {
  if (!image) return undefined;
  return {
    uri: image.uri,
    name: `permit_${Date.now()}.${IMAGE_FORMAT}`,
    type: getImageContentType(image.uri),
  };
}
