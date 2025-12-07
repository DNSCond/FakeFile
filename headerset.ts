import {cbyte, isValidDate, uppercaseAfterHyphen} from "./FakeFileHelpers.js";

export type HeadersetTSTypes = string | number | boolean | Date | null;

/**
 * about types:
 *
 * the default type is string, so it can be omitted.
 *
 * write a string like "key1=type1,key2=type2,key3=type3", case-insensitive,
 * whitespace ignored "key1 = type1, key2 = type2, key3 = type3".
 *
 * keys must be entered without the "headerset-*" prefix
 *
 * - isodatetime: write a isoString, formatted like Date.prototype.toISOString (or whatever you put in if its invalid)
 * - datetime-global: write a isoString, formatted like Date.prototype.toUTCString
 * - datetime-utc: alias to datetime-global
 * - datetime-local: write a isoString, formatted like Date.prototype.toString
 * - date: write a isoString, formatted like Date.prototype.toUTCString
 * - time: write a isoString, formatted like Date.prototype.toTimeString
 * - bytes: write a number representing bytes, then it formats for humans
 *
 * @param type one of the strings of the above list.
 * @param string the string to compute with.
 * @param keepType whether to convert that to a string.
 * @returns an object with `string` and `type`
 */
export function stringtoType(
    type: string | undefined, string: string | null,
    keepType: boolean = false): { string: HeadersetTSTypes, type: 'time' | 'string' | null, timeValue?: Date } {
    if (string === null) return {string: null, type: 'string'};
    const asIs = {string, type: 'string'} as const;
    if (type === undefined) return asIs;
    const timeValue = new Date(string),
        asTime = {
            string: timeValue,
            type: "time",
            timeValue,
        } as const;
    switch (type) {
        case "isodatetime":
            if (keepType) return asTime;
            if (isValidDate(timeValue)) {
                return {
                    string: timeValue.toISOString(),
                    type: "time", timeValue,
                };
            } else return asIs;
        case "datetime-utc":
        case "datetime-global":
            if (keepType) return asTime;
            return {
                string: timeValue.toUTCString(),
                type: "time", timeValue,
            };
        case "datetime-local":
            if (keepType) return asTime;
            return {
                string: timeValue.toString(),
                type: "time", timeValue,
            };
        case "date":
            if (keepType) return asTime;
            return {
                string: timeValue.toDateString(),
                type: "time", timeValue,
            };
        case "time":
            if (keepType) return asTime;
            return {
                string: timeValue.toTimeString(),
                type: "time", timeValue,
            };
        case "bytes":
            if (keepType) return {string: +string, type: "string"};
            return {string: cbyte(+string), type: "string"};
        default:
    }
    return asIs;
}

export type changes = { changeName: string, oldValue?: string | null | undefined, newValue: string | null };

export class FakeFileUIElement extends HTMLElement {
    #observer: MutationObserver = new MutationObserver(change => this.#attributeChangedCallback(change));
    #headerval: Map<string, string> = new Map;
    #abortController?: AbortController;
    #allowedHeaders!: string[];

    static get observedAttributes(): string[] {
        return ['ff-name', 'lastmod', 'open', 'bytesize', 'headerval', 'fakefile-bgcolor'];
    }

    constructor(allowedHeaders: string[]) {
        super();
        this.#allowedHeaders = allowedHeaders.map(s => `${s}`.toLowerCase());
        const head = document.createElement('dl');
        head.className = 'metadata';
        head.style.margin = '1em 0 1em 0';
        this.attachShadow({mode: 'open'}).append(Object.assign(document.createElement('style'), {
            innerText: `:host{font-family:monospace}
            details {color:black;/* File */
                border: solid black 2px;
                border-right: none;
                padding: 0.5em;
            }.content {
                border-left: solid black 2px;
                padding-left: 1ch;
            } dt, dd {
                display: inline;
                margin: 0;
            } dt:after {
                content: ": ";
            }`.replaceAll(/\s+/g, ' '),
        }), head);
    }

    connectedCallback(): void {
        this.#abortController?.abort();
        /*const {signal} = */
        (this.#abortController = new AbortController);
        this.#observer.observe(this, {attributes: true, attributeOldValue: true});

    }

    disconnectedCallback(): void {
        this.#abortController?.abort();
        this.#observer.disconnect();
    }

    #attributeChangedCallback(mutationRecords: MutationRecord[]): void {
        const changes: changes[] = [];
        for (const mutationRecord of mutationRecords) {
            const changeName = mutationRecord.attributeName as string,
                lowercaseName = changeName?.toLowerCase();
            if (lowercaseName?.startsWith('headerset-') || this.#allowedHeaders.includes(lowercaseName as string)) {
                const oldValue: string | null = mutationRecord.oldValue;
                const newValue: string | null = this.getAttribute(changeName);
                changes.push({changeName, oldValue, newValue});
            }
        }
        if (this.shadowRoot) {
            const metadata = this.shadowRoot.querySelector('.metadata')!;
            const elements: { [key: string]: HTMLDivElement } = {},
                missing: string[] = [], changeNames = changes.map(m => m.changeName);
            for (const child of metadata.children) {
                const keyName = (child as HTMLDivElement).dataset?.keyName;
                if (keyName !== undefined) {
                    if (changeNames.includes(keyName)) {
                        elements[keyName as string] = (child as HTMLDivElement);
                    } else {
                        missing.push(keyName as string);
                    }
                }
            }
            for (const changeName of changeNames) {
                if (!(changeName in elements) && !missing.includes(changeName)) {
                    missing.push(changeName);
                }
            }
            for (const string of missing) {
                const keyElement = this.ownerDocument.createElement('dt');
                const valElement = this.ownerDocument.createElement('dd');
                const div = this.ownerDocument.createElement('div');
                div.append(keyElement, valElement);
                div.dataset["keyName"] = string;
                elements[string] = div;
            }
            const changesToMake: HTMLElement[] = [];
            for (const change of changes) {
                if (elements[change.changeName]) {
                    // const {keyElement, valElement} = elements[change.changeName];
                    const keyElement = elements[change.changeName]!.querySelector('dt') ?? undefined;
                    const valElement = elements[change.changeName]!.querySelector('dd') ?? undefined;
                    if (change.newValue === null) {
                        elements[change.changeName]?.remove();
                    }
                    if (keyElement === undefined || valElement === undefined) {
                        throw new TypeError('InternalError');
                    }
                    if (change.newValue) {
                        const span = this.#normalizeValueString(change.changeName, change.newValue);
                        valElement.replaceChildren(span);
                        keyElement.innerText = uppercaseAfterHyphen(change.changeName);
                        changesToMake.push(elements[change.changeName]!);
                    }
                }
            }
            metadata.append(...changesToMake);
        }
    }

    #normalizeValueString(name: string, value: string): HTMLSpanElement | HTMLTimeElement {
        switch (name) {
            case "content-length": {
                const self = this;
                return (function (value) {
                    if (!Number.isFinite(value)) {
                        const innerText = 'Invalid Number';
                        return Object.assign(self.ownerDocument.createElement('data'), {innerText, value});
                    }
                    const innerText = cbyte(value);
                    return Object.assign(self.ownerDocument.createElement('data'), {innerText, value});
                })(+value);
            }
            case "last-modified": {
                const d = new Date(value), dateTime = d.toISOString(), innerText = d.toUTCString();
                return Object.assign(this.ownerDocument.createElement('time'), {dateTime, innerText});
            }
        }
        const type = this.#headerval.get(name.toLowerCase().replace(/^headerset-/i, ''));
        // return stringtoType(type, value).string as string;
        const result = stringtoType(type, value);
        let span, innerText = result.string as string, dateTime = result.timeValue?.toISOString();
        if (result.type === "time")
            span = Object.assign(this.ownerDocument.createElement('time'), {dateTime, innerText});
        else span = Object.assign(this.ownerDocument.createElement('span'), {innerText});
        return span;
    }
}
