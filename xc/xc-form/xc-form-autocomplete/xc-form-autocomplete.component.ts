/*
 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
 * Copyright 2023 Xyna GmbH, Germany
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
 */
import { AsyncPipe } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, forwardRef, HostBinding, inject, Input, NgZone, OnDestroy, Output, ViewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocomplete, MatAutocompleteTrigger, MatOption } from '@angular/material/autocomplete';
import { MatIconButton } from '@angular/material/button';
import { MatError, MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';

import { MULTISELECT_FILTER_SEPARATOR } from '@zeta/xc/xc-table/xc-table-data-source';

import { merge, Observable, OperatorFunction, Subject, Subscription } from 'rxjs';
import { debounceTime, map, tap } from 'rxjs/operators';

import { A11yService } from '../../../a11y';
import { Xo, XoObject, XoPropertyBinding } from '../../../api';
import { coerceBoolean, Comparable, isObject, isString, isTextOverflowing, Native, NativeArray } from '../../../base';
import { I18nService } from '../../../i18n';
import { XcI18nPipe } from '../../../i18n';
import { XcBoxableDataWrapper } from '../../shared/xc-data-wrapper';
import { XcOptionItem, XcOptionItemString, XcOptionItemValueType } from '../../shared/xc-item';
import { XcSortDirection, XcSortDirectionFromString, XcSortPredicate } from '../../shared/xc-sort';
import { XcIconComponent } from '../../xc-icon/xc-icon.component';
import { XcTooltipDirective } from '../../xc-tooltip/xc-tooltip.directive';
import { XcFormBaseComponent } from '../xc-form-base/xc-form-base.component';
import { XcFormBaseInputComponent } from '../xc-form-base/xc-form-baseinput.component';


interface FromXoEnumeratedPropertyCallbacks {
    setter?: (value: Native) => Native | void;
    options?: (value: XcOptionItem[]) => void;
}


export class XcAutocompleteDataWrapper<V = XcOptionItemValueType> extends XcBoxableDataWrapper<XcOptionItem<V>, V> {

    private readonly _valuesChange = new Subject<XcOptionItem<V>[]>();
    private _values: XcOptionItem<V>[];
    private _value: XcOptionItem<V>;


    static getXoEnumeratedValuesMapper<W = XcOptionItemValueType>(): OperatorFunction<NativeArray, XcOptionItem<W>[]> {
        return map((data: any[]) => data.map(value => <XcOptionItem>{ name: `${value}`, value: value }));
    }

    static getXoEnumeratedOptionItems<W = XcOptionItemValueType>(instance: Xo, propertyPath: string): Observable<XcOptionItem<W>[]> {
        const resolved = instance.resolveHead(propertyPath);
        const propertyHost = resolved.value;
        const propertyName = resolved.tail;
        if (propertyHost instanceof XoObject && propertyName) {
            const observable = propertyHost.enumeratedProperties.get(propertyName);
            if (observable) {
                return observable.pipe(
                    XcAutocompleteDataWrapper.getXoEnumeratedValuesMapper(),
                    tap((items: XcOptionItem[]) => items.unshift(XcOptionItemString()))
                );
            }
        }
    }

    static fromXoEnumeratedPropertyPath(instance: Xo, propertyPath: string, boxed = false, callbacks: FromXoEnumeratedPropertyCallbacks = {}): XcAutocompleteDataWrapper {
        const resolved = instance.resolveHead(propertyPath);
        const propertyHost = resolved.value;
        const propertyName = resolved.tail;
        if (propertyHost instanceof XoObject && propertyName) {
            const observable = propertyHost.enumeratedProperties.get(propertyName);
            if (observable) {
                return new XcAutocompleteDataWrapper(
                    // getter
                    () => propertyHost[propertyName],
                    // setter
                    callbacks.setter
                        ? value => propertyHost[propertyName] = callbacks.setter(value) || value
                        : value => propertyHost[propertyName] = value,
                    // xc option item mapped observable
                    observable.pipe(
                        XcAutocompleteDataWrapper.getXoEnumeratedValuesMapper(),
                        tap(callbacks.options)
                    ),
                    boxed
                );
            }
        }
    }

    static fromXoEnumeratedPropertyBinding<T extends XoObject, U extends Native>(binding: XoPropertyBinding<T, U>, boxed = false, callbacks: FromXoEnumeratedPropertyCallbacks = {}): XcAutocompleteDataWrapper {
        if (binding.instance && binding.accessor) {
            const propertyPaths = <any>binding.instance.decoratorClass.getAccessorMap();
            const propertyPath = <any>binding.accessor(propertyPaths);
            if (!isObject(propertyPath)) {
                const dataWrapper = XcAutocompleteDataWrapper.fromXoEnumeratedPropertyPath(binding.instance, propertyPath, boxed, callbacks);
                if (dataWrapper) {
                    return dataWrapper;
                }
                console.warn('fromXoEnumeratedPropertyBinding: accessor of binding does not yield an enumerated property');
            } else {
                console.warn('fromXoEnumeratedPropertyBinding: accessor of binding yields an xo instead of an enumerated property');
            }
        }
    }

    constructor(getter: () => V, setter: (value: V) => void, values?: XcOptionItem<V>[] | Observable<XcOptionItem<V>[]>, boxed = false) {
        super(getter, setter, boxed);
        if (values instanceof Array) {
            this.values = values;
        } else if (values) {
            values.subscribe(data => this.values = data);
        }
    }

    get valuesChange(): Observable<XcOptionItem<V>[]> {
        return this._valuesChange.asObservable();
    }

    set values(value: XcOptionItem<V>[]) {
        if (this._values !== value) {
            this._values = value;
            this.update();
        }
    }

    get values(): XcOptionItem<V>[] {
        return this._values;
    }

    set value(value: XcOptionItem<V>) {
        if (this._value !== value) {
            this._value = value;
            this.setter(this.value ? this.value.value : this.nullRepresentation);
        }
    }

    get value(): XcOptionItem<V> {
        return this._value;
    }

    preset(transform: (value: V) => XcOptionItem<V>) {
        this._value = transform(this.getter());
    }

    update() {
        if (this.values) {
            const getterValue = this.getter();
            const value = this.values.find(option =>
                option.value instanceof Comparable && getterValue instanceof Comparable
                    ? option.value.equals(getterValue)
                    : option.value === getterValue
            );
            if (value || !getterValue) {
                this._value = value;
            }
        }
        this._valuesChange.next(this.values);
    }
}

// this is an interface only used internally in the XcFormAutocompleteComponent class
interface XcOptionInternalAutocompleteItem extends XcOptionItem {
    showTooltip?: boolean;
}

@Component({
    selector: 'xc-form-autocomplete',
    templateUrl: './xc-form-autocomplete.component.html',
    styleUrls: ['../xc-form-base/xc-form-base.component.scss', './xc-form-autocomplete.component.scss'],
    providers: [{ provide: XcFormBaseComponent, useExisting: forwardRef(() => XcFormAutocompleteComponent) }],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatFormField, MatLabel, MatInput, ReactiveFormsModule, MatAutocompleteTrigger, MatAutocomplete, MatOption, XcTooltipDirective, XcIconComponent, MatError, MatIconButton, MatSuffix, MatIcon, AsyncPipe, XcI18nPipe, MatSelect]
})
export class XcFormAutocompleteComponent extends XcFormBaseInputComponent implements AfterViewInit, OnDestroy {
    private readonly cdRef = inject(ChangeDetectorRef);
    private readonly a11yService = inject(A11yService);
    private readonly i18nService = inject(I18nService);
    private readonly elementRef = inject(ElementRef<HTMLElement>);
    private readonly ngZone = inject(NgZone);


    /**
     * Screen Reader will read this string (translated) if this component is an autocomplete (default or asinput)
     * and there is no @Input for 'xc-form-autocomplete-a11yfocusline'
     */
    static globalAutocompleteA11yFocusLine = 'Autocomplete: You can type in text and select from options with the arrow keys';
    /**
     * Screen Reader will read this string (translated) if this component is asdropdown
     * and there is no @Input for 'xc-form-autocomplete-a11yfocusline'
     */
    static globalDropdownA11yFocusLine = 'Dropdown: You can switch between options with the arrow keys';

    private readonly updateFilteredOptions = new Subject<XcOptionItem>();

    /** determines whether the selected option can be reset to the first enabled option */
    private selectedIdxResettable = false;

    /** index of selected option within filtered and sorted options */
    private selectedIdx = -1;

    /** index of first enabled option within filtered and sorted options */
    private enabledIdx = -1;

    private openPanelWasJustClosed = false;
    private suppressNextFocusEmit = false;

    protected _subscription: Subscription;
    protected _asInput = false;
    protected _asDropdown = false;
    protected _caseSensitive = false;
    protected _fullTextSearch = false;
    protected _sortDirection = XcSortDirection.none;
    protected _options = new Array<XcOptionInternalAutocompleteItem>();

    filteredOptions: Observable<XcOptionInternalAutocompleteItem[]>;
    selectedOption: XcOptionInternalAutocompleteItem;

    protected _multiSelect = false;

    /** FormControl for mat-select in multiselect mode */
    multiSelectControl = new FormControl<string[]>([]);

    /** Options filtered for multiselect (excludes placeholder options with empty values) */
    filteredMultiSelectOptions: XcOptionItem[] = [];

    /** Last applied selection to restore on cancel */
    private lastAppliedMultiSelect: string[] = [];

    /** Previous multiselect value for tracking changes (screen reader) */
    private _previousMultiSelectValue: string[] = [];

    /** Flag to track if panel was closed by user action (Apply/Cancel) */
    private _closedByUserAction = false;

    /** Screen reader announcement text */
    multiSelectA11yAnnouncement = '';


    @ViewChild(MatAutocompleteTrigger, { static: false })
    trigger: MatAutocompleteTrigger;

    /** Reference to mat-select for multiselect mode */
    @ViewChild('multiSelectDropdown', { static: false })
    multiSelectDropdown: MatSelect;

    /** Reference to multiselect input for focus management */
    @ViewChild('multiSelectInput', { static: false })
    multiSelectInput: ElementRef<HTMLInputElement>;

    @Input('xc-form-autocomplete-a11yfocusline')
    readonly a11yFocusLine: string;

    @Output('xc-form-autocomplete-optionChange')
    readonly optionChange = new EventEmitter<XcOptionItem>();

    @Output('xc-form-autocomplete-optionsOpened')
    readonly optionsOpened = new EventEmitter();

    @Output('xc-form-autocomplete-optionsClosed')
    readonly optionsClosed = new EventEmitter();

    /**
     * Enable multiselect mode using mat-select with multiple attribute.
     * When enabled, users can select multiple options and values are
     * concatenated with MULTISELECT_FILTER_SEPARATOR ('|').
     */
    @Input({alias: 'xc-form-autocomplete-asmultiselect', transform: coerceBoolean})
    set multiSelect(value: boolean) {
        this._multiSelect = value;
        if (this._multiSelect) {
            this.initMultiSelectOptions();
            // Set dropdown suffix icon so clicking the arrow opens the panel
            this.suffix = 'dropdown';
        }
    }
    get multiSelect(): boolean {
        return this._multiSelect;
    }

    /**
     * Emits the MULTISELECT_FILTER_SEPARATOR-delimited string of selected values when multiselect is applied.
     */
    @Output('xc-form-autocomplete-multiSelectChange')
    readonly multiSelectChange = new EventEmitter<string>();


    constructor() {
        super();

        this.filteredOptions = merge(this.formControl.valueChanges.pipe(debounceTime(10)), this.updateFilteredOptions).pipe(
            // maps form option to string, if needed
            map((value: string | XcOptionItem) => isObject(value) ? this.optionName(<XcOptionItem>value) : <string>value),
            tap(() => this.asInput ? this.setActiveItem(-1) : null),
            // maps string to options array by filtering or copying
            map(value => value ? this.filter(value) : this.copy()),
            // sort options array by view
            map(array => this.sort(array)),
            // compute selected index
            tap(array => this.selectedIdx = array.findIndex(option => option === this.selectedOption)),
            // compute enabled index
            tap(array => this.enabledIdx = array.findIndex(option => !option.disabled))
        );
    }


    ngAfterViewInit() {
        const element = (this.elementRef.nativeElement as HTMLElement);
        this.ngZone.runOutsideAngular(() => {
            element.addEventListener('keydown', this.onkeydown);
            element.addEventListener('keyup', this.keyup);
        });

        // In multiselect mode, trigger may be undefined since mat-autocomplete isn't rendered
        if (this.trigger) {
            // set subscription
            this._subscription = this.trigger.panelClosingActions.subscribe(() => {
                this.checkValue();
                this.cdRef.detectChanges();
            });
            // prevent resetting of the active item by internal code
            (this.trigger as any)._resetActiveItem = () => {
                if (this.selectedIdxResettable && !this.asInput) {
                    this.setActiveItem(this.enabledIdx);
                }
                this.selectedIdxResettable = true;
            };
        }
        // provoke update of filtered options
        this.updateFilteredOptions.next(this.selectedOption);
        // important to avoid change detection error
        this.cdRef.detectChanges();
    }


    ngOnDestroy() {
        // remove subscription
        if (this._subscription) {
            this._subscription.unsubscribe();
        }

        const element = (this.elementRef.nativeElement as HTMLElement);
        this.ngZone.runOutsideAngular(() => {
            element.removeEventListener('keydown', this.onkeydown);
            element.removeEventListener('keyup', this.keyup);
        });
    }


    private readonly onScrollIfAutocompleteIsOpen = (event: Event) => {
        // In multiselect mode, trigger may be undefined
        if (!this.trigger) {
            return;
        }
        // Chrome on Windows triggers a scroll event if the browser needs to render a too big of a text into an input element
        // in this event, the event's target is the input element itself
        const targetIsInputElement = (event.target as HTMLElement).getAttribute ? ((event.target as HTMLElement).getAttribute('id') === this.input.id) : false;
        const targetIsOptionBox = this.trigger.autocomplete.panel ? event.target === this.trigger.autocomplete.panel.nativeElement : false;
        if (this.trigger.panelOpen && !targetIsInputElement && !targetIsOptionBox) {
            this.trigger.closePanel();
        }
    };


    protected suffixClickChangedValue(unfocusedInput: boolean) {
        this.suppressNextFocusEmit = unfocusedInput;
        super.suffixClickChangedValue(unfocusedInput);
        this.checkValue();
        this.updateFilteredOptions.next(this.selectedOption);
        if (this.trigger) {
            this.trigger.openPanel();
        }
    }


    protected checkValue() {
        let option: any;

        // value is a string?
        if (isString(this.value)) {
            // append new option as a fallback, if autocomplete is used as input
            const options = this.asInput
                ? (this.options ?? []).concat(XcOptionItemString(this.value))
                : (this.options ?? []);
            // try to find an option with the given value
            option = options.find(o => !o.disabled && o.name === this.value);
            // if no option was found, try to find one without case sensitivity
            if (option === undefined && !this.caseSensitive) {
                option = options.find(o => !o.disabled && o.name.toLowerCase() === this.value.toLowerCase());
            }
        } else {
            // use value, if it's an option
            option = isObject(this.value) ? this.value : undefined;
        }

        // restore selected option, if it's already selected
        if (this.value && option === this.selectedOption) {
            this.value = this.selectedOption;
        } else {
            // otherwise select new option
            this.select(option);
        }
    }


    protected sort(options: XcOptionItem[]) {
        return (this._sortDirection !== XcSortDirection.none)
            ? options.sort(XcSortPredicate(this._sortDirection, this.caseSensitive ? option => option.name : option => option.name.toLowerCase()))
            : options;
    }


    protected copy(): XcOptionItem[] {
        return this.options
            ? this.options.slice()
            : [];
    }


    protected filter(string: string): XcOptionItem[] {
        const result = this.options || [];
        if (!this.asDropdown) {
            return result.filter(option => {
                const optionName = this.caseSensitive ? this.optionName(option) : this.optionName(option).toLowerCase();
                const other = this.caseSensitive ? string : string.toLowerCase();
                return this.fullTextSearch
                    ? optionName.indexOf(other) >= 0
                    : optionName.startsWith(other);
            });
        }
        return result;
    }


    protected setActiveItem(idx: number) {
        if (this.trigger) {
            this.trigger.autocomplete._keyManager.setActiveItem(idx);
        }
    }


    protected select(value?: XcOptionItem) {
        if (this.selectedOption !== value) {
            this.option = value;
            this.optionChange.emit(value);
            this.cdRef.detectChanges();
        }
    }


    mousedown(event: MouseEvent) {
        if (!this.readonly && !this.disabled && this.trigger) {
            if (this.asDropdown) {
                event.preventDefault();
                if (this.trigger.panelOpen) {
                    this.trigger.closePanel();
                } else {
                    this.trigger.openPanel();
                }
            } else {
                this.trigger.openPanel();
            }
            this.cdRef.detectChanges();
        }
    }

    suffixMouseDown(event: MouseEvent) {
        super.suffixMouseDown(event);
        this.mousedown(event);
    }

    /**
     * Override suffixClick to open multiselect panel when clicking the dropdown arrow.
     */
    suffixClick(event: MouseEvent) {
        if (this.multiSelect && !this.disabled && !this.readonly) {
            event.stopPropagation();
            this.openMultiSelectPanel(event);
        } else {
            super.suffixClick(event);
        }
    }


    onkeydown = (event: KeyboardEvent) => {
        // In multiselect mode, trigger may be undefined
        if (!this.trigger) {
            return;
        }

        // trigger's panel is closed beforehand if user presses Enter
        // - therefore this.trigger.panelOpen is an insufficent indicator for checking if the panel was open
        const panelWasOpen = this.openPanelWasJustClosed || this.trigger.panelOpen;

        // prevent firefox from typing text into input field
        // is ctrl or alt true then this keydown event may be a short cut and default must not prevented
        if (!event.ctrlKey && !event.altKey && this.asDropdown && event.key !== 'Tab') {
            event.preventDefault();
        }

        if (event.key === 'Escape' || event.key === 'Enter') {
            this.trigger.closePanel();
            this.checkValue();
            if (panelWasOpen) {
                event.stopPropagation();
            }
            this.cdRef.detectChanges();
        }

        // should run in Angular's zone to avoid compatible problems
        this.ngZone.run(() => {
            super.onkeydown(event);
        });
    };


    keyup = (event: KeyboardEvent) => {

        // trigger's panel is closed beforehand if user presses Enter
        // - therefore this.trigger.panelOpen is a bad indicator for checking if the panel was open
        const panelWasOpen = this.openPanelWasJustClosed;
        this.openPanelWasJustClosed = false;

        if (panelWasOpen && event.key === 'Escape' || event.key === 'Enter') {
            event.stopPropagation();
        }

        // In multiselect mode, trigger may be undefined
        if (!this.trigger) {
            this.cdRef.detectChanges();
            return;
        }

        // fixes bug which sometimes caused the panel to be closed after clearing the input all at once
        // (via CTRL+BACKSPACE / CTRL+DELETE or, with the input's text being selected, via CTRL+X / BACKSPACE / DELETE)
        // not opening if tabbed to, while pressing "Tab" or "Tab + Shift"
        const notAllowed = ['Enter', 'Escape', 'Tab', 'Shift'];
        if (!this.trigger.panelOpen && !this.input.value && !notAllowed.includes(event.key)) {
            this.value = undefined;
            this.trigger.openPanel();
        }
        this.cdRef.detectChanges();
    };


    onfocus(event: FocusEvent) {
        this.cdRef.detectChanges();

        // suppress focus emit, if necessary
        if (!this.suppressNextFocusEmit) {
            this.focus.emit(event);
        }
        this.suppressNextFocusEmit = false;

        // In multiselect mode, trigger may be undefined since mat-autocomplete isn't rendered
        if (this.trigger) {
            // the autocomplete is being disabled and therefore the trigger won't auto-opening the panel as it would usually do
            this.trigger.autocompleteDisabled = true;
            setTimeout(() => {
                if (this.trigger) {
                    this.trigger.autocompleteDisabled = false;
                }
            }, 0);
        }

        // TODO FIXME - it must be possible to prevent the MatAutocompleteTrigger's auto opening of the panel on focus
        // if so, we could get rid of the following a11y service method
        const txt = this.a11yFocusLine || (this.label + ' '
            + this.i18nService.translate(this.asDropdown
                ? XcFormAutocompleteComponent.globalDropdownA11yFocusLine
                : XcFormAutocompleteComponent.globalAutocompleteA11yFocusLine));
        this.a11yService.screenreaderSpeak(txt);
    }


    onblur(event: FocusEvent) {
        // suppress next focus emit, after clicking an option (which refocuses the input)
        if (event.relatedTarget instanceof HTMLElement) {
            this.suppressNextFocusEmit = event.relatedTarget.classList.contains('mat-option');
        }
        // click on disabled options should not unfocus input field!
        if (event.relatedTarget instanceof HTMLElement && event.relatedTarget.classList.contains('mat-option-disabled')) {
            this.setFocus();
        } else {
            // fixes weird bug where autocomplete would not close when focusing an input or button afterwards
            // In multiselect mode, trigger may be undefined since mat-autocomplete isn't rendered
            if (this.trigger && (event.relatedTarget instanceof HTMLInputElement || event.relatedTarget instanceof HTMLButtonElement)) {
                this.trigger.closePanel();
                // check value for actions within focusing event
                this.checkValue();
            }
            this.cdRef.detectChanges();
            this.blur.emit(event);
        }
    }


    @Input({alias: 'xc-form-autocomplete-asinput', transform: coerceBoolean})
    set asInput(value: boolean) {
        this._asInput = value;
    }


    get asInput(): boolean {
        return this._asInput;
    }


    @HostBinding('class.as-dropdown')
    @Input({alias: 'xc-form-autocomplete-asdropdown', transform: coerceBoolean})
    set asDropdown(value: boolean) {
        this._asDropdown = value;
        if (this.asDropdown) {
            this.suffix = 'dropdown';
        }
    }


    get asDropdown(): boolean {
        return this._asDropdown;
    }


    @Input({alias: 'xc-form-autocomplete-casesensitive', transform: coerceBoolean})
    set caseSensitive(value: boolean) {
        this._caseSensitive = value;
    }


    get caseSensitive(): boolean {
        return this._caseSensitive;
    }


    @Input({alias: 'xc-form-autocomplete-fulltextsearch', transform: coerceBoolean})
    set fullTextSearch(value: boolean) {
        this._fullTextSearch = value;
    }


    get fullTextSearch(): boolean {
        return this._fullTextSearch;
    }


    @Input('xc-form-autocomplete-option')
    set option(value: XcOptionItem) {
        this.selectedOption = value;
        this.value = value;
    }


    get option(): XcOptionItem {
        return this.selectedOption;
    }


    @Input('xc-form-autocomplete-options')
    set options(value: XcOptionItem[]) {
        this._options = value as XcOptionInternalAutocompleteItem[];
        this.updateFilteredOptions.next(this.selectedOption ?? this.value);
        // Update multiselect options when options change (without resetting selection)
        if (this._multiSelect) {
            this.updateMultiSelectOptions();
        }
    }


    get options(): XcOptionItem[] {
        return this._options;
    }


    @Input('xc-form-autocomplete-sortdirection')
    set sortDirection(value: string) {
        this._sortDirection = XcSortDirectionFromString(value);
        this.updateFilteredOptions.next(this.selectedOption);
    }


    get sortDirection(): string {
        return XcSortDirection[this._sortDirection];
    }


    get stringValue(): string {
        return (
            isObject(this.value) ? this.value.name : this.value
        ) ?? '';
    }


    /**
     * Active option chosen by arrow keys (not to be confused with selected option)
     */
    get activeOption(): XcOptionItem {
        return this.trigger?.activeOption?.value;
    }


    optionSelected(option: MatOption) {
        this.select(this.value);
        // deselect active option, since we don't want that feature here
        option.deselect();
    }

    autocompleteOpened = false;
    autocompleteId = 'xc-autocomplete-' + Math.random().toString(36).slice(2);
    openedAutocomplete() {
        this.autocompleteOpened = true;
        // listen to scroll events to close the options and avoiding that the autocomplete scrolls away
        window.addEventListener('scroll', this.onScrollIfAutocompleteIsOpen, true);
        // restore active item to previously selected item
        if (!this.asInput) {
            this.setActiveItem(Math.max(this.selectedIdx, 0) || this.enabledIdx);
        }
        this.selectedIdxResettable = false;
        // emit event
        this.optionsOpened.emit();
        this.cdRef.detectChanges();

        // decide, if tooltip is needed
        // ----------------------------

        // In multiselect mode, trigger may be undefined
        if (!this.trigger) {
            return;
        }

        // getting the listbox, in which all option elements are
        const listbox = document.body.querySelector('#' + this.trigger.autocomplete.id);

        Array.from(listbox.children).forEach((matOptionElement: Element) => {
            // which option's box is too small for its content

            const mouseEnterMatOptionOneTimeListener = () => {
                // remove event listener because we need to calculate test overflow only once
                matOptionElement.removeEventListener('mouseenter', mouseEnterMatOptionOneTimeListener);

                // test if text is overflowing
                // ---------------------------

                // get the html element that holds the text of a XcOptionItem.name
                const subElements = Array.from(matOptionElement.querySelectorAll('*'));
                subElements.forEach(el => {
                    const childNodes = Array.from((el as HTMLElement).childNodes);
                    childNodes.forEach(childNode => {
                        if (childNode.nodeType === childNode.TEXT_NODE) {
                            const option = this.options.find(op => op.name === childNode.nodeValue.trim()) as XcOptionInternalAutocompleteItem;
                            if (option) {

                                const isOverflowing = isTextOverflowing(childNode.parentElement, option.name);

                                // is there change
                                if (!!option.showTooltip !== isOverflowing) {
                                    option.showTooltip = isOverflowing;
                                    this.cdRef.detectChanges();
                                    if (option.showTooltip) {
                                        const mouseEnterEvent = new MouseEvent('mouseenter');
                                        matOptionElement.dispatchEvent(mouseEnterEvent);
                                    } else {
                                        const mouseLeaveEvent = new MouseEvent('mouseleave');
                                        matOptionElement.dispatchEvent(mouseLeaveEvent);
                                    }
                                }
                            }
                        }
                    });
                });
            };

            matOptionElement.addEventListener('mouseenter', mouseEnterMatOptionOneTimeListener);
        });
    }


    closedAutocomplete() {
        this.autocompleteOpened = false;
        // do not listen anymore, because the listener is expensive
        window.removeEventListener('scroll', this.onScrollIfAutocompleteIsOpen, true);
        // emit event
        this.optionsClosed.emit();
        this.cdRef.detectChanges();
        this.openPanelWasJustClosed = true;
    }


    optionName(option: XcOptionItem): string {
        return option ? option.name : '';
    }


    // ========== Multiselect methods (mat-select based) ==========

    /**
     * Initialize options for multiselect mode.
     * Filters out any placeholder options with empty/null values.
     */
    private initMultiSelectOptions(): void {
        this.filteredMultiSelectOptions = (this._options || []).filter(o => {
            // Filter out empty placeholder options
            return o.value !== null && o.value !== undefined && o.value !== '';
        });
        this.lastAppliedMultiSelect = [];
        this.multiSelectControl.setValue([]);
    }

    /**
     * Updates multiselect options without resetting the current selection.
     * Called when options change after multiselect is already active.
     */
    private updateMultiSelectOptions(): void {
        this.filteredMultiSelectOptions = (this._options || []).filter(o => {
            return o.value !== null && o.value !== undefined && o.value !== '';
        });
    }

    /**
     * Returns display string showing selected option names.
     */
    getMultiSelectedNames(): string {
        const values = this.multiSelectControl.value || [];
        if (values.length === 0) {
            return '';
        }
        return values
            .map(val => {
                const opt = this.filteredMultiSelectOptions.find(o => o.value === val);
                return opt ? opt.name : val;
            })
            .join(', ');
    }

    /**
     * Opens the mat-select panel programmatically.
     * Focus moves to mat-select for native keyboard navigation.
     */
    openMultiSelectPanel(event: Event): void {
        if (this.readonly || this.disabled) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (this.multiSelectDropdown && !this.multiSelectDropdown.panelOpen) {
            this.multiSelectDropdown.open();
            // Focus mat-select for native arrow/space handling
            setTimeout(() => this.multiSelectDropdown?.focus(), 0);
        }
    }

    /**
     * Handles keyboard events on the INPUT element.
     * Opens panel on Arrow/Space/Enter keys.
     */
    onMultiSelectKeydown(event: KeyboardEvent): void {
        if (this.readonly || this.disabled) {
            return;
        }

        switch (event.key) {
            case 'Enter':
            case ' ':
            case 'ArrowDown':
            case 'ArrowUp':
                event.preventDefault();
                event.stopPropagation();
                this.openMultiSelectPanel(event);
                break;
        }
    }

    // Original _handleKeydown method backup
    private _originalHandleKeydown: ((event: KeyboardEvent) => void) | null = null;

    /**
     * Handles selection change for screen reader announcements.
     */
    onMultiSelectSelectionChange(event: any): void {
        const currentValues: string[] = event.value || [];
        const previousValues = this._previousMultiSelectValue;

        // Determine which option changed
        let changedValue: string | undefined;
        let isNowSelected: boolean;

        if (currentValues.length > previousValues.length) {
            // Option was added
            changedValue = currentValues.find(v => !previousValues.includes(v));
            isNowSelected = true;
        } else if (currentValues.length < previousValues.length) {
            // Option was removed
            changedValue = previousValues.find(v => !currentValues.includes(v));
            isNowSelected = false;
        }

        // Update previous value for next comparison
        this._previousMultiSelectValue = [...currentValues];

        if (changedValue) {
            const opt = this.filteredMultiSelectOptions.find(o => o.value === changedValue);
            if (opt) {
                const stateKey = isNowSelected
                    ? 'zeta.xc-form.autocomplete.selected'
                    : 'zeta.xc-form.autocomplete.not-selected';
                const state = this.i18nService.translate(stateKey);
                // Clear first, then set in microtask to ensure aria-live re-announces
                this.multiSelectA11yAnnouncement = '';
                this.cdRef.detectChanges();
                queueMicrotask(() => {
                    this.multiSelectA11yAnnouncement = `${opt.name}, ${state}`;
                    this.cdRef.detectChanges();
                });
            }
        }
    }

    /**
     * Returns the aria-label for a multiselect option, including its selection state.
     * Used on mat-option so the screen reader announces "OptionName, selected/not selected"
     * when navigating with arrow keys (via aria-activedescendant).
     */
    getMultiSelectOptionAriaLabel(option: XcOptionItem): string {
        const currentValues = this.multiSelectControl.value || [];
        const isSelected = currentValues.includes(option.value);
        const stateKey = isSelected
            ? 'zeta.xc-form.autocomplete.selected'
            : 'zeta.xc-form.autocomplete.not-selected';
        const state = this.i18nService.translate(stateKey);
        return `${option.name}, ${state}`;
    }

    /**
     * Handles mat-select openedChange event.
     * Patches _handleKeydown to intercept ENTER and ESC.
     */
    onMultiSelectOpenedChange(opened: boolean): void {
        if (opened) {
            // Reset user action flag
            this._closedByUserAction = false;

            // Save current state for cancel
            this.lastAppliedMultiSelect = [...(this.multiSelectControl.value || [])];
            // Initialize previous value for screen reader tracking
            this._previousMultiSelectValue = [...(this.multiSelectControl.value || [])];

            // Patch mat-select's _handleKeydown to intercept ENTER and ESC
            if (this.multiSelectDropdown && !this._originalHandleKeydown) {
                const matSelect = this.multiSelectDropdown as any;
                this._originalHandleKeydown = matSelect._handleKeydown.bind(matSelect);
                matSelect._handleKeydown = (event: KeyboardEvent) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        this.applyMultiSelect();
                        return;
                    }
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        this.cancelMultiSelect();
                        return;
                    }
                    this._originalHandleKeydown!(event);
                };
            }

            this.optionsOpened.emit();
        } else {
            // Restore original _handleKeydown
            if (this.multiSelectDropdown && this._originalHandleKeydown) {
                (this.multiSelectDropdown as any)._handleKeydown = this._originalHandleKeydown;
                this._originalHandleKeydown = null;
            }

            // If panel was closed without user action (focus-out), restore previous selection
            if (!this._closedByUserAction) {
                this.multiSelectControl.setValue([...this.lastAppliedMultiSelect]);
            }
            this._closedByUserAction = false;

            this.optionsClosed.emit();
            // Return focus to input
            this.multiSelectInput?.nativeElement?.focus();
        }
        this.cdRef.detectChanges();
    }

    /**
     * Applies the current multiselect selection.
     * Emits concatenated values with MULTISELECT_FILTER_SEPARATOR.
     */
    applyMultiSelect(): void {
        const selectedValues = this.multiSelectControl.value || [];
        const joinedValue = selectedValues.join(MULTISELECT_FILTER_SEPARATOR);

        // Update the component's value
        this.value = joinedValue;

        // Save as last applied
        this.lastAppliedMultiSelect = [...selectedValues];

        // Emit the change
        this.multiSelectChange.emit(joinedValue);

        // Mark as user-initiated close
        this._closedByUserAction = true;

        // Close the panel
        if (this.multiSelectDropdown) {
            this.multiSelectDropdown.close();
        }
    }

    /**
     * Cancels multiselect and restores previous selection.
     */
    cancelMultiSelect(): void {
        // Restore previous selection
        this.multiSelectControl.setValue([...this.lastAppliedMultiSelect]);

        // Mark as user-initiated close
        this._closedByUserAction = true;

        // Close the panel
        if (this.multiSelectDropdown) {
            this.multiSelectDropdown.close();
        }
    }

}
