"use client";

import { slugify, plural } from "./format";
import type { GalleryDetails, UploadResult } from "./galleryApi";
import { Field, INPUT_CLASS } from "./ui";

/**
 * Name, slug and description inputs for a gallery.
 * @param props.idPrefix - Makes the input ids unique on the page.
 * @param props.value - Current details.
 * @param props.onChange - Called with the new details.
 * @param props.autoSlug - Fill the slug in from the name as it's typed (for new galleries).
 */
export function GalleryFields({
  idPrefix,
  value,
  onChange,
  autoSlug = false,
}: {
  idPrefix: string;
  value: GalleryDetails;
  onChange: (details: GalleryDetails) => void;
  autoSlug?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor={`${idPrefix}-name`}>
          <input
            id={`${idPrefix}-name`}
            className={INPUT_CLASS}
            value={value.name}
            placeholder="Jordan 2026"
            onChange={(e) => onChange({ ...value, name: e.target.value, slug: autoSlug ? slugify(e.target.value) : value.slug })}
          />
        </Field>
        <Field label="Slug" htmlFor={`${idPrefix}-slug`}>
          <input
            id={`${idPrefix}-slug`}
            className={INPUT_CLASS}
            value={value.slug}
            placeholder="jordan-2026"
            autoCapitalize="none"
            autoCorrect="off"
            onChange={(e) => onChange({ ...value, slug: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Description" htmlFor={`${idPrefix}-description`}>
        <textarea
          id={`${idPrefix}-description`}
          className={`${INPUT_CLASS} min-h-20 resize-y`}
          value={value.description}
          placeholder="Optional"
          onChange={(e) => onChange({ ...value, description: e.target.value })}
        />
      </Field>
    </div>
  );
}

/**
 * How an upload went: a success line, or what failed and why. Stays up until
 * the next upload, since a list of failures needs reading.
 * @param props.result - The upload's result, or null before any.
 */
export function UploadOutcome({ result }: { result: UploadResult | null }) {
  if (!result) return null;
  if (!result.failures.length) {
    return <div className="mt-3 rounded-lg bg-green-950 px-3 py-2 text-sm text-green-300">Uploaded {plural(result.succeeded, "photo")}.</div>;
  }
  const total = result.succeeded + result.failures.length;
  return (
    <div className="mt-3 rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
      <div className="font-semibold">
        Uploaded {result.succeeded} of {total}. These failed:
      </div>
      <ul className="mt-1 list-disc pl-5 break-words">
        {result.failures.map((failure) => (
          <li key={failure}>{failure}</li>
        ))}
      </ul>
    </div>
  );
}
