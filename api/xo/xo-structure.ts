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
import { isArray, isObject } from '../../base';
import { FullQualifiedName, RuntimeContext } from './xo-describer';
import { XoArray, XoObject } from './xo-object';


const emptyStructureName = '<none>';


export class XoStructureType {

    constructor(public typeRtc?: RuntimeContext, public typeFqn?: FullQualifiedName, public typeLabel?: string, public typeAbstract?: boolean, public typeDocu?: string) {
    }

    protected getTypeObject(from: any): any {
        return from;
    }

    clone(shallow = false): XoStructureType {
        return new XoStructureType(this.typeRtc, this.typeFqn, this.typeLabel, this.typeAbstract, this.typeDocu);
    }

    decode(from: any): this {
        const typeObject = this.getTypeObject(from);
        this.typeRtc = RuntimeContext.decode(typeObject.rtc);
        this.typeFqn = FullQualifiedName.decode(typeObject.fqn);
        this.typeLabel = typeObject.label || typeObject.fqn;
        this.typeAbstract = typeObject.abstract || false;
        this.typeDocu = typeObject.docu || '';
        return this;
    }


    equals(other: this): boolean {
        return !!other &&
            (!this.typeRtc && !other.typeRtc || this.typeRtc.equals(other.typeRtc)) &&
            (!this.typeFqn && !other.typeRtc || this.typeFqn.equals(other.typeFqn)) &&
            this.typeLabel === other.typeLabel &&
            this.typeAbstract === other.typeAbstract &&
            this.typeDocu === other.typeDocu;
    }
}


export type XoStructureTypeClassInterface<T extends XoStructureType = XoStructureType> = new (parent: T, name: string) => T;


export abstract class XoStructureField extends XoStructureType {

    /** Class of XoStructurePrimitive to bypass circular reference issues */
    static XoStructurePrimitive: XoStructureTypeClassInterface<XoStructureField>;

    /** Class of XoStructureMethod to bypass circular reference issues */
    static XoStructureMethod: XoStructureTypeClassInterface<XoStructureField>;

    /** Class of XoStructureObject to bypass circular reference issues */
    static XoStructureObject: XoStructureTypeClassInterface<XoStructureField>;

    /** Class of XoStructureArray to bypass circular reference issues */
    static XoStructureArray: XoStructureTypeClassInterface<XoStructureField>;

    constructor(public parent: XoStructureField, public name: string, public label?: string, public docu?: string, typeRtc?: RuntimeContext, typeFqn?: FullQualifiedName, typeLabel?: string, typeAbstract?: boolean, typeDocu?: string) {
        super(typeRtc, typeFqn, typeLabel, typeAbstract, typeDocu);
    }

    decode(from: any): this {
        this.label = from.$label || '';
        this.docu = from.$docu || '';
        return super.decode(from);
    }

    clone(shallow = false): XoStructureField {
        return super.clone(shallow) as XoStructureField;
    }

    get path(): string {
        const parentPath = this.parent ? this.parent.path : '';
        const parentPathDot = parentPath ? parentPath + '.' : parentPath;
        return parentPathDot + this.name;
    }

    toString(): string {
        return this.label + ': ' + this.typeLabel;
    }

    toTypeLabel(): string {
        return this.typeLabel;
    }

    nullRepresentation(): string {
        return '{null}';
    }

    isExpandable(): boolean {
        return false;
    }

    equals(other: this): boolean {
        return super.equals(other) &&
            this.name === other.name &&
            this.label === other.label &&
            this.docu === other.docu &&
            (!this.parent && !other.parent || this.parent?.equals(other.parent));
    }
}


export class XoStructurePrimitive extends XoStructureField {
    protected getTypeObject(from: any): any {
        return from.$primitive;
    }

    decode(from?: any): this {
        if (from instanceof XoStructurePrimitive) {
            return <this>from;
        }
        return super.decode(from);
    }

    clone(shallow = false): XoStructurePrimitive {
        return new XoStructurePrimitive(this.parent, this.name, this.label, this.docu, this.typeRtc, this.typeFqn, this.typeLabel, this.typeAbstract, this.typeDocu);
    }

    static empty(): XoStructurePrimitive {
        return new XoStructurePrimitive(null, emptyStructureName);
    }
}



function getElementInstance(name: string, from?: any, parent?: XoStructureField): XoStructureField {
    if (isObject(from)) {
        if (isObject(from.$object)) {
            return new XoStructureField.XoStructureObject(parent, name).decode(from);
        }
        if (isObject(from.$list)) {
            return new XoStructureField.XoStructureArray(parent, name).decode(from);
        }
        if (isObject(from.$method)) {
            return new XoStructureField.XoStructureMethod(parent, name).decode(from);
        }
        return new XoStructureField.XoStructurePrimitive(parent, name).decode(from);
    }
    return null;
}


export class XoStructureMethod extends XoStructureField {
    readonly params  = new Array<XoStructureField>();
    readonly returns = new Array<XoStructureField>();

    protected getTypeObject(from: any): any {
        return from.$method;
    }

    decode(from: any): this {
        if (from instanceof XoStructureMethod) {
            return <this>from;
        }

        const typeObject = this.getTypeObject(from);

        // read return list
        if (isArray(typeObject.returns)) {
            for (const returnType of typeObject.returns) {
                this.returns.push(getElementInstance(returnType.$label || '', returnType, this));
            }
        }

        // read param list
        if (isArray(typeObject.params)) {
            for (const paramType of typeObject.params) {
                this.params.push(getElementInstance(paramType.$label || '', paramType, this));
            }
        }

        return super.decode(from);
    }


    clone(shallow = false): XoStructureMethod {
        const result = new XoStructureMethod(this.parent, this.name, this.label, this.docu, this.typeRtc, this.typeFqn, this.typeLabel, this.typeAbstract, this.typeDocu);
        result.params.push(...this.params.map(field => field.clone()));
        result.returns.push(...this.params.map(field => field.clone()));
        return result;
    }

    static empty(): XoStructureMethod {
        return new XoStructureMethod(null, emptyStructureName);
    }

    toString(): string {
        // choose first return type as type label
        const returnType = (this.returns.length === 1)
            ? this.returns[0].toString()
            : 'void';
        const params = this.params?.map(p => p.toString()).join(', ') ?? '';
        return this.label + `(${params}) \u21D2 ` + returnType;
    }
}


export abstract class XoStructureComplexField extends XoStructureField {
    protected _children = new Array<XoStructureField>();

    clone(shallow = false): XoStructureComplexField {
        const result = super.clone() as XoStructureComplexField;
        result._children = shallow ? this.children : this.children.map(child => child.clone());
        return result;
    }

    get length(): number {
        return this.children.length;
    }

    get children(): XoStructureField[] {
        return this._children;
    }

    set children(value: XoStructureField[]) {
        this.children.forEach(child => child.parent = null);
        this._children = value;
        this.children.forEach(child => child.parent = this);
    }

    addChildren(...value: XoStructureField[]) {
        this.children.push(...value);
        value.forEach(child => child.parent = this);
    }

    isExpandable(): boolean {
        return true;
    }

    abstract valueInstance(rtc: RuntimeContext, fqn: FullQualifiedName): any;
}


export class XoStructureObject extends XoStructureComplexField {

    protected getTypeObject(from: any): any {
        return from.$object;
    }

    decode(from?: any): this {
        if (from instanceof XoStructureObject) {
            return <this>from;
        }

        // decode children
        if (isObject(from)) {
            this.children.splice(
                this.length, 0,
                ...Object.keys(from)
                    .filter(key => !key.startsWith('$'))
                    .map(key => getElementInstance(key, from[key], this))
            );
        }
        return super.decode(from);
    }

    clone(shallow = false): XoStructureObject {
        const result = new XoStructureObject(this.parent, this.name, this.label, this.docu, this.typeRtc, this.typeFqn, this.typeLabel, this.typeAbstract, this.typeDocu);
        result._children = shallow ? this.children : this._children.map(child => child.clone());
        return result;
    }

    valueInstance(rtc: RuntimeContext, fqn: FullQualifiedName): XoObject {
        const xo = new XoObject();
        xo.rtc = rtc;
        xo.fqn = fqn;
        return xo;
    }

    static empty(): XoStructureObject {
        return new XoStructureObject(null, emptyStructureName);
    }
}


export class XoStructureArray extends XoStructureComplexField {

    protected getTypeObject(from: any): any {
        return from.$list;
    }

    decode(from?: any): this {
        if (from instanceof XoStructureArray) {
            return <this>from;
        }
        return super.decode(from);
    }

    clone(shallow = false): XoStructureArray {
        const result = new XoStructureArray(this.parent, this.name, this.label, this.docu, this.typeRtc, this.typeFqn, this.typeLabel, this.typeAbstract, this.typeDocu);
        result._children = shallow ? this._children : this._children.map(child => child.clone());
        return result;
    }

    isPrimitive(): boolean {
        return this.typeFqn.isPrimitive();
    }

    add(idx: number = this.length): XoStructureField {
        // an array can't contain an array, so it contains either a primitive or an object.
        // this is a server-side limitation in the declaration of xyna objects
        const fieldClass = this.isPrimitive()
            ? XoStructureField.XoStructurePrimitive
            : XoStructureField.XoStructureObject;
        const fieldName = String(idx);
        const newField = new fieldClass(this, fieldName);
        newField.label = '[' + fieldName + ']';
        newField.typeRtc = this.typeRtc;
        newField.typeFqn = this.typeFqn;
        newField.typeLabel = this.typeLabel;

        let i = idx;
        let field = newField;
        while (i < this.length) {
            const nextField = this.children[i];
            this.children[i] = field;
            field = nextField;
            field.name = String(i + 1);
            field.label = '[' + field.name + ']';
            i++;
        }
        this.children.push(field);
        return newField;
    }

    remove(field: XoStructureField): number {
        const idx = this.children.indexOf(field);
        if (idx >= 0) {
            // update name and label of all following fields
            let i = this.length;
            while (--i > idx) {
                this.children[i].name  = this.children[i - 1].name;
                this.children[i].label = this.children[i - 1].label;
            }
            // remove field
            this.children.splice(idx, 1);
            field.parent = null;
        }
        return idx;
    }

    valueInstance(rtc: RuntimeContext, fqn: FullQualifiedName): XoArray | Array<any> {
        if (this.isPrimitive()) {
            return [];
        }
        const xo = new XoArray();
        xo.rtc = rtc;
        xo.fqn = fqn;
        return xo;
    }

    toString(): string {
        return super.toString() + '[]';
    }

    toTypeLabel(): string {
        return '[' + super.toTypeLabel() + ']';
    }

    static empty(): XoStructureArray {
        return new XoStructureArray(null, emptyStructureName);
    }

    static fromObject(object: XoStructureObject): XoStructureArray {
        return new XoStructureArray(
            object.parent, object.name, object.label, object.docu, object.typeRtc, object.typeFqn, object.typeLabel, object.typeAbstract, object.typeDocu
        );
    }
}



XoStructureField.XoStructurePrimitive = XoStructurePrimitive;
XoStructureField.XoStructureMethod = XoStructureMethod;
XoStructureField.XoStructureObject = XoStructureObject;
XoStructureField.XoStructureArray = XoStructureArray;
