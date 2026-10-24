import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as bffModule from "../utils/bff";
import { createPermit, type BffPermit } from "../utils/bffMobileApi";
import {
  buildPermitAttachment,
  getImageContentType,
  isValidLeaveImageSize,
  MAX_IMAGE_SIZE_BYTES,
  MIN_DESCRIPTION_LENGTH,
  resolvePickedAsset,
  validateLeaveForm,
  type LeaveFormValues,
  type PickedImageResult,
} from "../utils/leaveForm";

/**
 * M06 — Leave Request remains valid without an attachment.
 *
 * The BFF adapter (`utils/bffMobileApi.ts#createPermit`) already accepts
 * `attachment?: FilePart | null` and omits the multipart field when absent;
 * these tests pin the form validation and request-construction behavior to
 * that optional-attachment contract. No live request is sent: `bffRequest`
 * is spied and the captured FormData is inspected locally.
 */

const validWithoutImage: LeaveFormValues = {
  category: "sakit",
  description: "Demam tinggi sejak semalam, memerlukan istirahat.",
  image: null,
};

/** Native multipart file part as appended by `appendNativeFile` on device. */
interface NativeFilePart {
  uri: string;
  name: string;
  type: string;
}

type FormDataAppendValue = string | NativeFilePart;

const permitResponse: BffPermit = {
  id: "permit-1",
  category: "sakit",
  description: "Demam tinggi sejak semalam.",
  date: "2026-10-24",
  approval_status: "pending",
  attachment_url: null,
};

function getFormFieldNames(form: FormData): string[] {
  const names: string[] = [];
  form.forEach((value: FormDataEntryValue, key: string) => {
    names.push(key);
    return value;
  });
  return names;
}

describe("M06 — Leave Request remains valid without an attachment", () => {
  describe("form validation with an optional attachment", () => {
    it("accepts a valid category/description submission with no image selected", () => {
      const validation = validateLeaveForm(validWithoutImage);

      expect(validation.category).toBe(true);
      expect(validation.description).toBe(true);
      expect(validation.attachment).toBe(true);
      expect(validation.valid).toBe(true);
    });

    it("still rejects an invalid category or a too-short description", () => {
      // SAFETY: the out-of-domain category string is the value under test; it
      // must fail validation exactly like any unrecognized category.
      const invalidCategory = "lainnya" as LeaveFormValues["category"];
      expect(
        validateLeaveForm({
          ...validWithoutImage,
          category: invalidCategory,
        }).valid,
      ).toBe(false);

      expect(
        validateLeaveForm({
          ...validWithoutImage,
          description: "x".repeat(MIN_DESCRIPTION_LENGTH - 1),
        }).valid,
      ).toBe(false);

      expect(
        validateLeaveForm({
          ...validWithoutImage,
          description: "   ",
        }).description,
      ).toBe(false);
    });

    it("accepts a submission with a selected valid file", () => {
      const values: LeaveFormValues = {
        ...validWithoutImage,
        image: { uri: "file:///cache/permit_1.jpeg", fileSize: 1024 },
      };
      const validation = validateLeaveForm(values);

      expect(validation.attachment).toBe(true);
      expect(validation.valid).toBe(true);
    });

    it("rejects a submission whose selected file exceeds the 10 MB limit", () => {
      const oversized: LeaveFormValues = {
        ...validWithoutImage,
        image: {
          uri: "file:///cache/permit_huge.jpeg",
          fileSize: MAX_IMAGE_SIZE_BYTES + 1,
        },
      };
      const validation = validateLeaveForm(oversized);

      expect(validation.attachment).toBe(false);
      expect(validation.valid).toBe(false);
      expect(isValidLeaveImageSize(MAX_IMAGE_SIZE_BYTES + 1)).toBe(false);
      expect(isValidLeaveImageSize(MAX_IMAGE_SIZE_BYTES)).toBe(true);
    });
  });

  describe("picker result handling", () => {
    it("treats a picker cancel as no asset and keeps the form unchanged", () => {
      const canceled: PickedImageResult = {
        canceled: true,
        assets: [
          {
            uri: "file:///cache/should_not_be_used.jpeg",
            fileSize: 1024,
          },
        ],
      };

      expect(resolvePickedAsset(canceled)).toBeNull();
      expect(resolvePickedAsset(null)).toBeNull();
      expect(resolvePickedAsset({ canceled: false, assets: [] })).toBeNull();
      expect(resolvePickedAsset({ canceled: false })).toBeNull();
    });

    it("returns the first asset when a file is actually picked", () => {
      const picked: PickedImageResult = {
        canceled: false,
        assets: [
          { uri: "file:///cache/permit_2.png", fileSize: 2048 },
          { uri: "file:///cache/ignored.jpeg", fileSize: 4 },
        ],
      };

      expect(resolvePickedAsset(picked)).toEqual({
        uri: "file:///cache/permit_2.png",
        fileSize: 2048,
      });
    });
  });

  describe("multipart request construction via createPermit", () => {
    let capturedBodies: FormData[];
    let appendSpy: jest.SpyInstance;

    /** The Jest runtime's spec-compliant FormData stringifies non-Blob values,
     * while the React Native runtime keeps `{ uri, name, type }` file parts
     * intact; spying on append records the arguments actually handed to the
     * runtime FormData on every call. */
    const appendedParts = (): Array<[string, FormDataAppendValue]> =>
      appendSpy.mock.calls.map((call: [string, FormDataAppendValue]) => [
        call[0],
        call[1],
      ]);

    beforeEach(() => {
      capturedBodies = [];
      appendSpy = jest.spyOn(globalThis.FormData.prototype, "append");
      jest
        .spyOn(bffModule, "bffRequest")
        .mockImplementation(
          async (_path: string, options?: { body?: unknown }) => {
            const body = options?.body;
            if (!(body instanceof FormData)) {
              throw new Error(
                "Expected createPermit to send a locally built FormData body",
              );
            }
            capturedBodies.push(body);
            return permitResponse;
          },
        );
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("omits the attachment field from the multipart body when no image is selected", async () => {
      await createPermit({
        category: "sakit",
        description: "Demam tinggi sejak semalam, memerlukan istirahat.",
        attachment: buildPermitAttachment(null),
      });

      // Wire-level view: the constructed multipart body has exactly the three
      // text fields and no attachment entry.
      expect(capturedBodies).toHaveLength(1);
      expect(getFormFieldNames(capturedBodies[0])).toEqual([
        "category",
        "description",
        "date",
      ]);

      // Append-level view: no attachment part is ever appended.
      expect(appendedParts().map(([name]) => name)).toEqual([
        "category",
        "description",
        "date",
      ]);
      expect(
        appendedParts().filter(([name]) => name === "attachment"),
      ).toHaveLength(0);
    });

    it("appends the attachment as a native file part when a valid file is selected", async () => {
      const image = { uri: "file:///cache/permit_3.png", fileSize: 2048 };
      await createPermit({
        category: "pergi",
        description: "Menghadiri acara keluarga di luar kota.",
        attachment: buildPermitAttachment(image),
      });

      expect(capturedBodies).toHaveLength(1);
      expect(getFormFieldNames(capturedBodies[0])).toEqual([
        "category",
        "description",
        "date",
        "attachment",
      ]);

      const attachmentParts = appendedParts().filter(
        ([name]) => name === "attachment",
      );
      expect(attachmentParts).toHaveLength(1);
      expect(attachmentParts[0][1]).toEqual({
        uri: "file:///cache/permit_3.png",
        name: expect.stringMatching(/^permit_\d+\.jpeg$/),
        type: getImageContentType(image.uri),
      });
    });

    it("pins the optional-attachment rule in the izin.tsx source", () => {
      const source = readFileSync(
        join(process.cwd(), "app/perizinan/izin.tsx"),
        "utf8",
      );

      expect(source).toContain("validateLeaveForm(formData)");
      expect(source).toContain("buildPermitAttachment(formData.image)");
      expect(source).toContain("resolvePickedAsset(result)");
      // The mandatory-attachment rejection must not return.
      expect(source).not.toContain("Foto bukti wajib dilampirkan");
    });
  });
});
