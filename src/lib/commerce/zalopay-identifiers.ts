export type ZaloPayIdentifierOptions = Readonly<{
  readonly clock: () => Date;
  readonly nextId: () => string;
}>;

export type ZaloPayIdentifiers = Readonly<{
  readonly appTransId: () => string;
}>;

const twoDigits = (value: number): string => value.toString().padStart(2, "0");

export const createZaloPayIdentifiers = ({ clock, nextId }: ZaloPayIdentifierOptions): ZaloPayIdentifiers => ({
  appTransId: () => {
    const date = clock();
    const vietnamDate = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    const yymmdd = `${twoDigits(vietnamDate.getUTCFullYear() % 100)}${twoDigits(vietnamDate.getUTCMonth() + 1)}${twoDigits(vietnamDate.getUTCDate())}`;
    return `${yymmdd}-${nextId()}`;
  },
});
