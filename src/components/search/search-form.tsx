"use client";

import { useRouter } from "@/i18n/navigation";
import { type FormEvent } from "react";

interface SearchFormProps {
  readonly locale: string;
  readonly defaultValue: string;
  readonly placeholder: string;
  readonly submitText: string;
  readonly labelText: string;
}

export function SearchForm({
  locale,
  defaultValue,
  placeholder,
  submitText,
  labelText,
}: SearchFormProps) {
  const router = useRouter();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = formData.get("q")?.toString() || "";
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full border border-nh-border bg-nh-surface-primary p-1 text-left sm:w-auto"
    >
      <label className="sr-only" htmlFor="site-search">
        {labelText}
      </label>
      <input
        id="site-search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[14px] leading-[22px] outline-none placeholder:text-nh-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent sm:px-3"
      />
      <button
        type="submit"
        className="whitespace-nowrap bg-nh-ink px-4 py-2 text-[12px] font-medium uppercase tracking-[0.08em] text-white transition-colors duration-150 ease-out hover:bg-nh-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nh-accent sm:px-5"
      >
        {submitText}
      </button>
    </form>
  );
}
