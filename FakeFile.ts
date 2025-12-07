import {cbyte, isValidDate, uppercaseAfterHyphen} from "./FakeFileHelpers.js";

const {promise, resolve} = Promise.withResolvers<unknown>();
const colorRegExp = /^#?[a-f0-9]/i;

export class FakeFileUIElement extends HTMLElement {
    #_onDomInserted = Promise.withResolvers<void>()

    constructor() {
        super();
        Promise.all([promise, this.#_onDomInserted]).then(() => this?._whenAllFFElementsDefined());
    }

    // https://github.com/DNSCond/dnscond.github.io
    getFullPath(): string[] {
        let current: HTMLElement | null = this, result = [this.fileName || current.tagName];
        while ((current = current.parentElement) instanceof FakeFileUIElement) {
            result.push(current.fileName || current.tagName);
        }
        return result.reverse();
    }

    getPath(): string {
        return this.getFullPath().join('/');
    }

    set fileName(value: string | null) {
        if (value === null) this.removeAttribute('ff-name');
        else this.setAttribute('ff-name', value);
    }

    get fileName(): string | null {
        return this.getAttribute('ff-name');
    }

    connectedCallback(): void {
        this.#_onDomInserted.resolve();
    }

    _whenAllFFElementsDefined(): void {
    }

    get bytesize(): number {
        return NaN;
    }

    get bytesizeFormatted(): string {
        const {bytesize} = this;
        if (bytesize > 0)
            return cbyte(bytesize);
        return "NaN bytes";
    }

    /**
     * returns an invalid date, inherit from it please.
     */
    get lastMod(): Date | null {
        return new Date(NaN);
    }

    set backgroundColor(color: string | null) {
        if (color === null) {
            this.removeAttribute('fakefile-bgcolor');
        } else if (typeof (color as unknown) === "string" && colorRegExp.test(color)) {
            color = '#' + color.replace(/^#/, '');
            this.setAttribute('fakefile-bgcolor', color);
        } else
            throw new TypeError('color must be a color in the hex color format');
    }

    get backgroundColor(): string | null | undefined {
        const color = this.getAttribute('fakefile-bgcolor');
        if (color === null) return null; else {
            if (colorRegExp.test(color)) {
                return color;
            } else return undefined;
        }
    }
}


export class FakeFileFile extends FakeFileUIElement {
    #observer: MutationObserver = new MutationObserver(change => this.#attributeChangedCallback(change));
    #headerval: Map<string, string> = new Map;
    #abortController?: AbortController;
    #backgroundDefault = '#E7F4FD';/*#C9EAFF*/

    static get observedAttributes(): string[] {
        return ['ff-name', 'lastmod', 'open', 'bytesize', 'headerval', 'fakefile-bgcolor'];
    }

    constructor() {
        super();
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.innerText = 'FakeFileFile';
        summary.className = 'summery';
        const head = document.createElement('dl');
        head.className = 'metadata';
        head.style.margin = '1em 0 1em 0';
        const div = document.createElement('div');
        div.className = 'content';
        div.append(Object.assign(document.createElement('slot'),
            {innerHTML: '<span style=font-style:italic>empty file</span>'}));
        details.append(summary, head, div);//
        const bgc = Object.assign(
            document.createElement('style'), {
                innerText: `details{background-color:${this.#backgroundDefault}}`,
                className: "background-color",
            });
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
        }), bgc, details);
    }

    override get backgroundColor() {
        return super.backgroundColor ?? this.#backgroundDefault;
    }

    override set backgroundColor(value) {
        super.backgroundColor = value;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.#abortController?.abort();
        const {signal} = (this.#abortController = new AbortController);
        const metadata = this.shadowRoot?.querySelector('.metadata');
        this.#observer.observe(this, {attributes: true, attributeOldValue: true});
        (this.shadowRoot!.querySelector('details') as HTMLDetailsElement)!.addEventListener(
            // @ts-ignore
            'toggle', (event: ToggleEvent) => {
                this.open = (event.newState === 'open')
            }, {signal});
        {
            const style = this.shadowRoot!.querySelector('style.background-color')! as HTMLStyleElement;
            style.innerText = `details{background-color:${this.backgroundColor}}`;
        }
        if (metadata) {
            metadata.replaceChildren();
            this.updateHeaders();
        }
    }

    disconnectedCallback(): void {
        this.#abortController?.abort();
        this.#observer?.disconnect();
    }

    override set bytesize(value: number | null) {
        if (value === null) {
            this.removeAttribute('bytesize');
        } else if (Number.isSafeInteger(value)) {
            this.setAttribute('bytesize', String(value));
        } else throw RangeError(`${value} is not a valid bytesize=""`);
    }

    override get bytesize(): number {
        return +this.getAttribute('bytesize')!;
    }

    set open(value: boolean | string) {
        if (value || value === '') {
            this.setAttribute('open', value === true ? '' : value);
        } else {
            this.removeAttribute('open');
        }
    }

    get open(): boolean {
        return this.hasAttribute('open');
    }

    set headerVal(value: string | null) {
        if (value === null) this.removeAttribute('headerVal');
        else this.setAttribute('headerVal', value);
    }

    get headerVal(): string | null {
        return this.getAttribute('headerVal');
    }

    setHeaderValType(key: string, type: string, overwrite: boolean = false): this {
        return this.setHeaderValTypes((new Map).set(key, type), overwrite);
    }

    setHeaderValTypes(values: Map<string, string>, overwrite: boolean = false): this {
        const result = [], regexp = /^[a-z\-_0-9]+$/i;
        const array = [...this.#headerval];
        if (overwrite) array.length = 0;
        for (const [key, val] of array.concat([...values])) {
            if (regexp.test(key) || regexp.test(val)) {
                result.push(`${key}=${val}`);
            } // else {console.warn('warning setting: key =', key, '; val =', val);}
        }
        this.headerVal = result.join();
        return this;
    }

    getHeaderValTypes(): Map<string, string> | null {
        const temporary = this.headerVal?.replaceAll(/\s+/g, '');
        if (temporary === undefined) return null;
        const result: Map<string, string> = new Map;
        const types: { key: string | undefined, val: string | undefined }[] = temporary
            .toLowerCase().split(/,/g)
            .map(m => m.split(/=/g))
            .map(([key, val]) => ({key, val}));
        for (const {key, val} of types) {
            if (key === undefined || val === undefined)
                continue;
            result.set(key, val);
        }
        return result;
    }

    override set lastMod(value: Date | string | number | null) {
        if (value === null) {
            this.removeAttribute('lastmod');
        } else {
            const isoString = (new Date(value)).toISOString();
            this.setAttribute('lastmod', isoString);
        }
    }

    override get lastMod(): Date | null {
        const dt = this.getAttribute('lastmod');
        if (dt == null) return null;
        return new Date(dt);
    }

    setHeader(name: string, value: HeadersetTSTypes): this {
        name = `${name}`;
        const headersetName = `headerset-${name}`;
        if (value === null) {
            this.removeAttribute(headersetName);
            return this;
        }
        if (value instanceof Date) {
            value = value.toISOString();
            const overwrite = !this.getHeaderValTypes()?.get(name);
            if (overwrite) {
                this.setHeaderValType(name, 'datetime-global');
            }
        }
        this.setAttribute(headersetName, `${value}`);
        return this;
    }

    setHeaders(keyValues: Record<string, HeadersetTSTypes>): this {
        for (const [key, value] of (Object.entries(keyValues))) {
            this.setHeader(camelToKebab(key), value);
        }
        return this;
    }


    getHeader(name: string): HeadersetTSTypes {
        name = `${name}`;
        const headersetName = `headerset-${name}`;
        const value = this.getAttribute(headersetName);
        const type = this.#headerval.get(name)
        return stringtoType(type, value, true).string;
    }

    getAllHeaders(): Map<string, HeadersetTSTypes> {
        const constructor = this.constructor as typeof FakeFileFile,
            result: Map<string, string | boolean | Date> = new Map;
        for (const attribute of this.attributes) {
            const {name, value} = attribute;
            if ((name.startsWith('headerset-')) || (constructor.observedAttributes.includes(name))) {
                result.set(name, value);
            }
        }
        return result;
    }

    override _whenAllFFElementsDefined(): void {
    }
}

export class FakeFileDirectory extends FakeFileUIElement {
    #observer: MutationObserver = new MutationObserver(_change => this.#updateRegistered());
    #registered: FakeFileUIElement[] = [];
    #abortController?: AbortController;
    #backgroundDefault = '#FFE8BA';

    static get observedAttributes(): string[] {
        return ['ff-name', 'isexpanded'];
    }

    constructor() {
        super();
        const list = document.createElement('ul');
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.innerText = 'FakeFileDirectory';
        summary.className = 'summery';
        details.append(summary, list);
        const bgc = Object.assign(
            document.createElement('style'), {
                innerText: `details{background-color:${this.#backgroundDefault}}`,
                className: "background-color",
            });
        this.attachShadow({mode: 'open'}).append(Object.assign(document.createElement('style'), {
            innerText: `:host{font-family:monospace}
            details {color:black;/* Directory */
                border: solid black 2px;
                border-right: none;
                padding: 0.5em;
            }li{margin-top:0.5em;
            margin-bottom:0.5em;}
            ul{margin-bottom:0;
            list-style-type:none;
            padding-left: 1ch;
            }`.replaceAll(/\s+/g, ' '),
        }), bgc, details);
    }

    override get backgroundColor() {
        return super.backgroundColor ?? this.#backgroundDefault;
    }

    override set backgroundColor(value) {
        super.backgroundColor = value;
    }

    override connectedCallback() {
        super.connectedCallback();
        this.#updateRegistered();
        const {signal} = (this.#abortController = new AbortController);
        this.#observer.observe(this, {childList: true});
        (this.shadowRoot!.querySelector('details') as HTMLDetailsElement)!.addEventListener(
            // @ts-ignore
            'toggle', (event: ToggleEvent) => {
                this.isexpanded = (event.newState === 'open');
            }, {signal});
        {
            const style = this.shadowRoot!.querySelector('style.background-color')! as HTMLStyleElement;
            style.innerText = `details{background-color:${this.backgroundColor}}`;
        }
    }

    attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
        if (this.shadowRoot) {
            switch (name) {
                case 'ff-name': {
                    const summery = this.shadowRoot.querySelector('summary');
                    if (summery) summery.innerText = `Directory: "${newValue || this.tagName}"`;
                    break;
                }
                case "isexpanded": {
                    const details = this.shadowRoot.querySelector('details');
                    if (details) {
                        if (details.open !== (newValue !== null)) {
                            details.open = newValue !== null;
                        }
                    }
                    break;
                }
                case "fakefile-bgcolor": {
                    const style = this.shadowRoot.querySelector('style.background-color') as HTMLStyleElement | null;
                    if (style) {
                        if (newValue && colorRegExp.test(newValue)) {
                            style.innerText = `details{background-color:${newValue}}`;
                        } else {
                            style.innerText = `details{background-color:${this.#backgroundDefault}}`;
                        }
                    }
                }
                    break;
            }
        }
    }

    disconnectedCallback(): void {
        this.#abortController?.abort();
        this.#observer?.disconnect();
    }

    /**
     * Returns an up-to-date array of immediate child FakeFiles and Directories.
     */
    get childrenEntries(): FakeFileUIElement[] {
        return [...this.#registered];
    }

    #updateRegistered() {
        // only *direct* children (not nested descendants)
        // this.#registered = Array.from(this.children)
        // .filter((el): el is FakeFileFile | FakeFileDirectory =>
        // el instanceof FakeFileFile || el instanceof FakeFileDirectory);
        const children = (this.#registered = Array.from(this.children, child => {
            if (child instanceof FakeFileUIElement) {
                return child;
            } else {
                child.removeAttribute('slot');
                return null;
            }
        }).filter(m => m !== null) as FakeFileUIElement []);
        children.forEach(function (
            each, index) {
            const slotname = `FakeFile-${index++}`;
            each.setAttribute('slot', slotname);
        });
        this.#updateSlottedItems();
    }

    #updateSlottedItems() {
        if (this.shadowRoot) {
            const children = this.childrenEntries.map(child => {
                const listitem = this.ownerDocument.createElement('li'),
                    slot = this.ownerDocument.createElement('slot');
                slot.style.display = 'block';
                slot.name = child.slot;
                listitem.append(slot);
                return listitem;
            });
            this.shadowRoot.querySelector('ul')!.replaceChildren(...children);
        }
    }

    set isexpanded(value: boolean | string) {
        if (value || value === '') {
            this.setAttribute('isexpanded', value === true ? '' : value);
        } else {
            this.removeAttribute('isexpanded');
        }
    }

    get isexpanded(): boolean {
        return this.hasAttribute('isexpanded');
    }

    get lastModified(): Date | null {
        return findLatestDate(this.childrenEntries.map(m => m.lastMod));
    }

    override get lastMod(): Date | null {
        return this.lastModified;
    }

    override get bytesize(): number {
        return this.childrenEntries.map(m => m.bytesize).reduce((prev, curr) => curr + prev, 0);
    }

    override _whenAllFFElementsDefined(): void {
        this.#updateRegistered();
    }
}

customElements.define('ff-d', FakeFileDirectory);
customElements.define('ff-f', FakeFileFile);
Promise.all([customElements.whenDefined('ff-d'), customElements.whenDefined('ff-f')]).then(resolve);
