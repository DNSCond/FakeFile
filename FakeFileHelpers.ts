// helpers
export function cbyte(bytesize: number): string {
    const units = Array("bytes", "KB", "MB", "GB", "TB");
    let i = 0;
    bytesize = +bytesize;
    if (!Number.isFinite(bytesize))
        throw new TypeError('bytesize resulted into a non finite number');
    while (bytesize >= 1024) {
        bytesize = bytesize / 1024;
        if (units[++i] === undefined) {
            i--;
            break
        }
    }
    return `${bytesize.toFixed(2).replace(/\.?0*$/, '')} ${units[i]}`;
}

export function joinArray<IN, OUT>(array: IN[], seperator: OUT | ((index: number, array: IN[]) => OUT), replacer?: ((v: IN, k: number) => OUT) | undefined, isCallback: boolean = false): OUT [] {
    const a = Array.from(array, replacer ?? (m => m as unknown as OUT)), result: OUT[] = [];
    let index = 0;
    for (const t of a) {
        if (isCallback) {
            result.push(t, Function.prototype.apply.call(
                seperator as ((index: number, array: IN[]) => OUT),
                result, [index++, a]));
        } else {
            result.push(t, seperator as OUT);
        }
    }
    if (result.length > 2)
        result.length = result.length - 1;
    return result;
}

export const isValidDate = function (date: Date): boolean {
    return !isNaN(date as unknown as number);
};

export function findLatestDate<T>(array: T[], toDate: (object: T, index: number) => Date | null = m => m as Date | null): Date | null {
    const dates = Array.from(array, toDate);
    // @ts-expect-error
    const dateResult = Math.max(...(dates.filter(m => m !== null) as Date[]).filter(isValidDate));
    const asDate = new Date(dateResult);
    if (isValidDate(asDate)) return asDate;
    else return null;
}

export function findFirstDate<T>(array: T[], toDate: (object: T, index: number) => Date | null = m => m as Date | null): Date | null {
    const dates = Array.from(array, toDate);
    // @ts-expect-error
    const dateResult = Math.min(...(dates.filter(m => m !== null) as Date[]).filter(isValidDate));
    const asDate = new Date(dateResult);
    if (isValidDate(asDate)) return asDate;
    else return null;
}

export function uppercaseAfterHyphen(str: string): string {
    return String(str).split('').map((char, i, arr) => {
        if (i === 0 || arr[i - 1] === '-') return char.toUpperCase(); else return char;
    }).join('');
}

export function kebabToCamel(str: string): string {
    return String(str).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

export function camelToKebab(str: string): string {
    return String(str).replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-+/, '');
}
