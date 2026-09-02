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
import { Component, EventEmitter, Input, Output, ViewChild, inject, numberAttribute } from '@angular/core';

import { BehaviorSubject, Subscription } from 'rxjs';
import { Box2, BufferGeometry, Color, Mesh, Object3D, OrthographicCamera, RawShaderMaterial, Scene, Shape, Vector2, Vector3, WebGLRenderer } from 'three';

import { AuthService } from '../../auth/auth.service';
import { ceilBase, Constructor, dateString, dateTimeString, days, digits, downloadFile, factorMultiplicity, floorBase, fpint, MimeTypes, minutes, NOP, seconds, timeString } from '../../base';
import { XcWebGLFont, XcWebGLFontAlignment } from '../xc-webgl/xc-webgl-font';
import { getQuadTriangles3, getQuadTriangles3raw } from '../xc-webgl/xc-webgl-geometry';
import { XcWebGLObject, XcWebGLObjectAttributeName } from '../xc-webgl/xc-webgl-object';
import { XcWebGLComponent, XcWebGLInteraction } from '../xc-webgl/xc-webgl.component';
import { XcGraphDataSource, XcGraphLineStyle, XcGraphOption, XcGraphOptions, XcGraphSlice, XcGraphType, XcGraphUtils, XcTimeInterval } from './xc-graph-data-source';


interface Transform<S> {
    perform: (value: S) => S;
    inverse: (value: S) => S;
}


class XcShaderMaterial extends RawShaderMaterial {

    private static readonly vertexShader = `
        precision highp float;
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        attribute vec3 position;

        void main() {
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    private static readonly fragmentShader = `
        precision highp float;
        uniform vec3 color;
        uniform int style;

        void main() {
            if (style == 1 && sin(0.4 * (gl_FragCoord.x - gl_FragCoord.y)) < 0.0) {
                discard;
            }
            gl_FragColor = vec4(color, 1.0);
        }
    `;


    constructor() {
        super({
            vertexShader: XcShaderMaterial.vertexShader,
            fragmentShader: XcShaderMaterial.fragmentShader,
            uniforms: {
                color: { value: new Vector3(1, 1, 1) },
                style: { value: 0 }
            }
        });
    }


    setUniformColor(color: number) {
        this.uniformsNeedUpdate = true;
        this.uniforms.color.value.set(
             
            ((color & 0xff0000) >> 16) / 256,
            ((color & 0x00ff00) >> 8) / 256,
            ((color & 0x0000ff) >> 0) / 256
             
        );
    }


    setUniformStyle(style: number) {
        this.uniformsNeedUpdate = true;
        this.uniforms.style.value = style;
    }
}


export class XcShaderMesh extends Mesh<BufferGeometry, XcShaderMaterial> {

    constructor(geometry: BufferGeometry, material: XcShaderMaterial, public color?: number, public style?: number) {
        super(geometry, material);
        this.onBeforeRender = () => this.beforeRender();
    }


    protected beforeRender() {
        this.material.setUniformColor(this.color ?? 0xffffff);
        this.material.setUniformStyle(this.style ?? 0);
    }
}


export class XcShaderObject extends XcWebGLObject<XcShaderMesh, XcShaderMaterial> {

    constructor(material: XcShaderMaterial, parent: Object3D, color?: number, style?: number) {
        super(XcShaderMesh, material, parent, [XcWebGLObject.getPositionAttribute(Float32Array, 3)]);
        this.object.color = color;
        this.object.style = style;
    }
}


class XcGraph extends XcShaderObject {

    readonly timeValues: { time: number; value: number }[] = [];


    constructor(
        readonly valueToPixelsTransform: Transform<number>,
        material: XcShaderMaterial,
        parent: Object3D,
        color: number,
        style: number,
        protected options: XcGraphOptions
    ) {
        super(material, parent, color, style);
    }


    protected updatePositionData(x0: number, x1: number, y: number, z: number, first: boolean, last: boolean): number[] {
        return [];
    }


    update(slices: XcGraphSlice[], interval: XcTimeInterval, resolution: number, resolutionWidth: number, z: number) {
        this.timeValues.splice(0);
        const positionData = [];
        let idx: number;
        if ((idx = XcGraphUtils.getSliceIndex(slices, interval, resolution)) >= 0) {
            let slice: XcGraphSlice, ptr: { globalOff: number; localOff: number; len: number };
            while ((slice = slices[idx++]) && (ptr = XcGraphUtils.getSliceValuesPtr(slice, interval, resolution))) {
                // compute vertices off all values to render
                let first = true;
                let off = ptr.globalOff + ptr.localOff;
                while (ptr.len-- > 0) {
                    const valueIdx = off - ptr.globalOff;
                    const x0 = (off - ptr.localOff) * resolutionWidth;
                    const x1 = x0 + resolutionWidth;
                    const y = slice.values[valueIdx];
                    positionData.push(...this.updatePositionData(x0, x1, y, z, first, ptr.len === 0));
                    first = false;
                    off++;
                    // store time value pairs
                    this.timeValues.push({
                        time: slice.time + resolution * valueIdx,
                        value: slice.values[valueIdx]
                    });
                }
            }
        }
        this.setData(XcWebGLObjectAttributeName.POSITION, positionData);
    }
}


abstract class XcNormalGraph extends XcGraph {

    private v0: Vector2;


    protected getNormalVector(v0: Vector2, v1: Vector2): Vector2 {
        const tangent = new Vector2(v1.x - v0.x, this.valueToPixelsTransform.perform(v1.y - v0.y)).normalize();
        const normal = new Vector2(tangent.y, this.valueToPixelsTransform.inverse(-tangent.x));
        return normal;
    }


    protected updatePositionData(x0: number, x1: number, y: number, z: number, first: boolean, last: boolean): number[] {
        if (first && last) {
            return this.updatePositionDataDifference(
                new Vector2(x0, y),
                new Vector2(x1, y),
                z
            );
        }
        if (first) {
            this.v0 = new Vector2(x0, y);
            return [];
        }
        if (last) {
            return this.updatePositionDataDifference(
                this.v0,
                new Vector2(x1, y),
                z
            );
        }
        return this.updatePositionDataDifference(
            (this.v0.clone()),
            (this.v0 = new Vector2(x0 + (x1 - x0) / 2, y)),
            z
        );
    }


    protected abstract updatePositionDataDifference(v0: Vector2, v1: Vector2, z: number): number[];
}


class XcVoidGraph extends XcNormalGraph {

    protected updatePositionDataDifference(v0: Vector2, v1: Vector2, z: number): number[] {
        return [
            ...getQuadTriangles3raw(v0.x, -Number.MAX_SAFE_INTEGER, v1.x, 0, z),
            ...getQuadTriangles3raw(v0.x, 0, v1.x, Number.MAX_SAFE_INTEGER, z)
        ];
    }
}


class XcLineGraph extends XcNormalGraph {

    protected static readonly WIDTH = 2;


    protected updatePositionDataDifference(v0: Vector2, v1: Vector2, z: number): number[] {
        const width = this.options[XcGraphOption.WIDTH] ?? XcLineGraph.WIDTH;
        const normal = this.getNormalVector(v0, v1).multiplyScalar(width / 2);
        return [
            v0.x - normal.x, v0.y - normal.y, z, // 0
            v0.x + normal.x, v0.y + normal.y, z, // 1
            v1.x - normal.x, v1.y - normal.y, z, // 2
            v0.x + normal.x, v0.y + normal.y, z, // 1
            v1.x + normal.x, v1.y + normal.y, z, // 3
            v1.x - normal.x, v1.y - normal.y, z  // 2
        ];
    }
}


class XcAreaGraph extends XcNormalGraph {

    protected updatePositionDataDifference(v0: Vector2, v1: Vector2, z: number): number[] {
        return getQuadTriangles3raw(v0.x, Math.min(v0.y, 0), v1.x, Math.abs(v1.y), z);
    }
}


class XcDotGraph extends XcGraph {

    protected static readonly SIZE = 4;


    protected updatePositionData(x0: number, x1: number, y: number, z: number): number[] {
        const sizeX = this.options[XcGraphOption.SIZE] ?? XcDotGraph.SIZE;
        const sizeY = this.valueToPixelsTransform.inverse(sizeX);
        return getQuadTriangles3(x0 + (x1 - x0 - sizeX) / 2, y - sizeY / 2, z, sizeX, sizeY);
    }
}


class XcBarGraph extends XcGraph {

    protected static readonly PADDING_LEFT = 0;
    protected static readonly PADDING_RIGHT = 1;


    protected updatePositionData(x0: number, x1: number, y: number, z: number): number[] {
        const paddingLeft = this.options[XcGraphOption.PADDING_LEFT] ?? XcBarGraph.PADDING_LEFT;
        const paddingRight = this.options[XcGraphOption.PADDING_RIGHT] ?? XcBarGraph.PADDING_RIGHT;
        return getQuadTriangles3raw(x0 + paddingLeft, Math.min(y, 0), x1 - paddingRight, Math.max(y, 0), z);
    }
}


abstract class XcGraphStampFont extends XcWebGLFont {

    offset: Vector2;
    lineWidth: number;
    lineHeight: number;


    protected abstract createLineShape(offset: number): Shape;


    protected createShapes(text: string, size: number, alignment: XcWebGLFontAlignment, padding: number, boundingBox: Box2): Shape[] {
        const factor = XcWebGLFont.getAlignmentFactor(alignment);
        return super.createShapes(text, size, alignment, padding, boundingBox).concat(
            this.lineWidth && this.lineHeight
                ? this.createLineShape(
                    (boundingBox.min.x + factor * (boundingBox.max.x - boundingBox.min.x)) +
                    (factor * 2 - 1) * padding
                )
                : []
        );
    }


    createGeometry(text: string, size: number, alignment = XcWebGLFontAlignment.CENTER, padding = 0): BufferGeometry {
        return super.createGeometry(text, size, alignment, padding).translate(this.offset.x, this.offset.y, 0);
    }
}


class XcGraphTimestampFont extends XcGraphStampFont {

    protected createLineShape(offset: number): Shape {
        const w2 = this.lineWidth / 2;
        return new Shape([
            new Vector2(offset + this.offset.x - w2, -this.offset.y),
            new Vector2(offset + this.offset.x + w2, -this.offset.y),
            new Vector2(offset + this.offset.x + w2, -this.offset.y + this.lineHeight),
            new Vector2(offset + this.offset.x - w2, -this.offset.y + this.lineHeight)
        ]);
    }
}


class XcGraphValuestampFont extends XcGraphStampFont {

    protected createLineShape(offset: number): Shape {
        const h2 = this.lineHeight / 2;
        return new Shape([
            new Vector2(offset - this.offset.x - this.lineWidth, -this.offset.y - h2),
            new Vector2(offset - this.offset.x, -this.offset.y - h2),
            new Vector2(offset - this.offset.x, -this.offset.y + h2),
            new Vector2(offset - this.offset.x - this.lineWidth, -this.offset.y + h2)
        ]);
    }
}


class XcGraphResources {

    readonly shaderMaterial: XcShaderMaterial;


    constructor(
        readonly liveOffsetColor: number,
        readonly headColor: number,
        readonly axesColor: number,
        readonly backColor: number,
        readonly overColor: number,
        readonly textColor: number,
        readonly datestampColor: number,
        readonly timestampColor: number,
        readonly valuestampColor: number,
        readonly font: string
    ) {
        this.shaderMaterial = new XcShaderMaterial();
    }


    destroy() {
        this.shaderMaterial.dispose();
    }
}


const Z = (value: number) => -value;

const second = seconds(1);
const minute = minutes(1);
const day = days(1);

const K = 1000;
const M = K * K;
const B = M * K;
const T = B * K;
const Q = T * K;


export class XcGraphScene {

    /** Maximum number of valuestamps */
    private static readonly NUM_VALUESTAMPS = 5;

    /** Height of the graph head in pixels */
    private static readonly HEAD_SIZE = 30;

    /** Offset of the graph head in pixels */
    private static readonly HEAD_OFFSET = 2;

    /** Offset of the date axis to the time axis in pixels */
    private static readonly DATE_AXIS_OFFSET = 2;

    /** Offset of the time axis to the graph in pixels */
    private static readonly TIME_AXIS_OFFSET = 2;

    /** Offset of the value axis to the graph in pixels */
    private static readonly VALUE_AXIS_OFFSET = 2;

    /** Height of the date axis in pixels (including offset) */
    private static readonly DATE_AXIS_SIZE = 20;

    /** Height of the time axis in pixels (including offset) */
    private static readonly TIME_AXIS_SIZE = 20;

    /** Width of the value axis in pixels (including offset) */
    private static readonly VALUE_AXIS_SIZE = 40;

    /** Initial sample width of the graph */
    private static readonly DEFAULT_SAMPLE_WIDTH = 10;

    /** Padding of datestamp, timestamp and valuestamp texts */
    private static readonly STAMP_PADDING = 4;

    private subscription: Subscription;
    private resources: XcGraphResources;

    private rootViewportPosition: Vector2;
    private rootViewportSize: Vector2;
    private rootCamera: OrthographicCamera;
    private rootScene: Scene;

    private graphViewportPosition: Vector2;
    private graphViewportSize: Vector2;
    private graphCamera: OrthographicCamera;
    private graphScene: Scene;
    private graphAnchor: Object3D;

    private textFont: XcWebGLFont;
    private name: string;
    private nameMesh: XcShaderMesh;
    private unit: string;
    private unitMesh: XcShaderMesh;

    private datestampFont: XcGraphTimestampFont;
    private readonly datestampMeshes = new Map<number, XcShaderMesh>();

    private timestampFont: XcGraphTimestampFont;
    private readonly timestampMeshes = new Map<number, XcShaderMesh>();

    private valuestampFont: XcGraphValuestampFont;
    private readonly valuestampMeshes = new Map<number, XcShaderMesh>();

    private liveOffsetObject: XcShaderObject;
    private headObject: XcShaderObject;
    private axesObject: XcShaderObject;
    private backObject: XcShaderObject;
    private overObject: XcShaderObject;

    /** Width of a sample in pixels (including gap, if any) */
    private sampleWidth = XcGraphScene.DEFAULT_SAMPLE_WIDTH;

    /** Left-over fraction of the first sample in pixels outside the view port */
    private sampleFraction = 0;

    /** Time offset of timestamps (compensating server time difference) */
    private serverTimeOffset = 0;

    /** Current timezone offset of first timestamp (to detect daylight saving time) */
    private timezoneOffset = 0;

    /** Delta between two timestamps */
    private deltaTime = 0;

    /** Delta between two valuestamps */
    private deltaValue = 0;

    /** Minimum of all graph slice values */
    private minValue = 0;

    /** Maximum of all graph slice values */
    private maxValue = 0;

    /** X coordinate of the viewport (lower left) */
    private x = 0;

    /** Y coordinate of the viewport (lower left) */
    private y = 0;

    /** Viewport width */
    private width = 0;

    /** Viewport height */
    private height = 0;

    /** Translation start date */
    private translationDate: number;

    /** Translation offset in milliseconds */
    private translationTime = 0;

    /** Translation time of half of the graph view port */
    private translationHalf = 0;

    /** User translation interaction to compute mouse offsets from */
    private translatingInteraction: XcWebGLInteraction;

    /** Determines wether the user is allowed to translate the graph */
    private allowTranslating = true;

    /** Determines wether the user is currently translating the graph */
    private translating = false;

    /** Determines wether the user is allowed to hover over graph samples */
    private allowHovering = false;

    /** Time of the graph sample the user is currently hovering over */
    readonly hoveringAt = new BehaviorSubject<number>(undefined);

    /** Id of the graph containing the sample used for hovering */
    readonly hoveringId = Number.MAX_SAFE_INTEGER;

    /** Map with graphs by id */
    readonly graphs = new Map<number, XcGraph>();

    /** Functions to convert between value and pixel space */
    readonly valueToPixelsTransform: Transform<number> = {
        perform: this.valueToPixels.bind(this),
        inverse: this.pixelsToValue.bind(this)
    };


    constructor(readonly dataSource: XcGraphDataSource) {
    }


    private getGraphInstance(id: number, type: XcGraphType): XcGraph {
        if (!this.graphs.has(id)) {
            const color = this.dataSource.getGraphColor(id, type);
            const style = this.dataSource.getGraphStyle(id, type);
            const options = this.dataSource.getGraphOptions(id, type);
            let clazz: Constructor<XcGraph>;
            switch (type) {
                case XcGraphType.VOID: clazz = XcVoidGraph; break;
                case XcGraphType.LINE: clazz = XcLineGraph; break;
                case XcGraphType.AREA: clazz = XcAreaGraph; break;
                case XcGraphType.DOT: clazz = XcDotGraph; break;
                case XcGraphType.BAR: clazz = XcBarGraph; break;
                default:
                    clazz = XcGraph;
                    console.warn('[XC-GRAPH] unknown graph type! (' + type + ')');
            }
            this.graphs.set(
                id,
                new clazz(
                    ...<ConstructorParameters<typeof XcGraph>>[
                        this.valueToPixelsTransform,
                        this.resources.shaderMaterial,
                        this.graphAnchor,
                        color,
                        style,
                        options
                    ]
                )
            );
        }
        return this.graphs.get(id);
    }


    private removeSubscription() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }


    private renewSubscription() {
        this.removeSubscription();
        this.subscription = this.dataSource.markForChange.subscribe(() => {

            this.updateDeltaTime();
            this.updateDeltaValue();

            // create and update graphs
            this.dataSource.getGraphData().forEach(graphData => {
                // graph from slices
                this.getGraphInstance(
                    graphData.id,
                    graphData.type
                ).update(
                    graphData.slices,
                    this.timeInterval,
                    this.resolution,
                    this.sampleWidth,
                    Z(6)
                );
                // graph from voids
                this.getGraphInstance(
                    -graphData.id,
                    XcGraphType.VOID
                ).update(
                    graphData.voids,
                    this.timeInterval,
                    this.resolution,
                    this.sampleWidth,
                    Z(32)
                );
            });

            // remove graphs without data
            this.graphs.forEach((graph, id, map) => {
                if (id !== this.hoveringId && !this.dataSource.getGraphData().some(graphData => graphData.id === Math.abs(id))) {
                    graph.dispose();
                    map.delete(id);
                }
            });

            // adjust translation time to keep graph centered after a resolution change
            const translationHalf = this.pixelsToTime(this.graphViewportSize.width / 2);
            if (this.translationHalf !== translationHalf) {
                // adjust translation time, but keep live state
                if (this.translationTime < 0) {
                    this.translationTime += translationHalf - this.translationHalf;
                    if (this.translationTime >= 0) {
                        this.translationTime = 0;
                        this.translationDate = undefined;
                    }
                }
                this.translationHalf = translationHalf;
            }
        });
    }


    private addMesh(mesh: Mesh, parent: Object3D): Mesh {
        parent.add(mesh);
        return mesh;
    }


    private removeMesh(mesh: Mesh): Mesh {
        if (mesh) {
            mesh.parent.remove(mesh);
            mesh.geometry.dispose();
        }
        return mesh;
    }


    private removeMeshes(map: Map<number, Mesh>, filter?: (value: number) => boolean) {
        map.forEach((mesh, value) => {
            if (!filter || filter(value)) {
                this.removeMesh(mesh);
                map.delete(value);
            }
        });
    }


    private get resolution(): number {
        return this.dataSource.resolution;
    }


    private get timeOffset(): number {
        return this.dataSource.timeOffset;
    }


    private get timeInterval(): XcTimeInterval {
        return this.dataSource.timeInterval;
    }


    private set timeInterval(value: XcTimeInterval) {
        this.dataSource.timeInterval = value;
    }


    private valueToString(value: number): string {
        const v = Math.abs(value);
        if (v >= Q) {
            return value / Q + 'Q';
        }
        if (v >= T) {
            return value / T + 'T';
        }
        if (v >= B) {
            return value / B + 'B';
        }
        if (v >= M) {
            return value / M + 'M';
        }
        if (v >= K * 10) {
            return value / K + 'K';
        }
        return value + '';
    }


    private timeToString(time: number): string {
        return this.resolution >= minute
            ? timeString(time, this.dataSource.timestampMinuteFormat, { leadingZeroes: this.dataSource.timestampLeadingZeroes })
            : timeString(time, this.dataSource.timestampSecondFormat, { leadingZeroes: this.dataSource.timestampLeadingZeroes });
    }


    private dateToString(time: number): string {
        return dateString(time, this.dataSource.datestampFormat, { leadingZeroes: this.dataSource.datestampLeadingZeroes });
    }


    private valueToPixels(value: number): number {
        return value / (this.maxValue - this.minValue) * this.graphViewportSize.height;
    }


    private pixelsToValue(pixels: number): number {
        return pixels * (this.maxValue - this.minValue) / this.graphViewportSize.height;
    }


    private timeToPixels(time: number): number {
        return time / this.resolution * this.sampleWidth;
    }


    private pixelsToTime(pixels: number): number {
        return pixels * this.resolution / this.sampleWidth;
    }


    private now(): number {
        return (this.translationDate ?? +new Date() + this.serverTimeOffset) - this.timeOffset + this.translationTime;
    }


    private updateSampleFraction() {
        const excessWidth = ceilBase(this.graphViewportSize.width, this.sampleWidth) - this.graphViewportSize.width;
        this.sampleFraction = fpint(excessWidth) % this.sampleWidth;
    }


    private updateAxes() {
        this.liveOffsetObject.setData(
            XcWebGLObjectAttributeName.POSITION,
            getQuadTriangles3(
                this.graphViewportSize.width,
                XcGraphScene.DATE_AXIS_SIZE + XcGraphScene.TIME_AXIS_SIZE,
                Z(4),
                2,
                this.graphViewportSize.height
            )
        );
        this.headObject.setData(
            XcWebGLObjectAttributeName.POSITION,
            getQuadTriangles3(
                0,
                this.rootViewportSize.height - XcGraphScene.HEAD_SIZE + XcGraphScene.HEAD_OFFSET,
                Z(8),
                this.rootViewportSize.width - XcGraphScene.VALUE_AXIS_SIZE,
                XcGraphScene.HEAD_SIZE
            )
        );
        this.axesObject.setData(
            XcWebGLObjectAttributeName.POSITION,
            [
                // date axis
                ...getQuadTriangles3(
                    0,
                    0,
                    Z(8),
                    this.rootViewportSize.width,
                    XcGraphScene.DATE_AXIS_SIZE - XcGraphScene.DATE_AXIS_OFFSET
                ),
                // time axis
                ...getQuadTriangles3(
                    0,
                    XcGraphScene.DATE_AXIS_SIZE,
                    Z(8),
                    this.rootViewportSize.width,
                    XcGraphScene.TIME_AXIS_SIZE - XcGraphScene.TIME_AXIS_OFFSET
                ),
                // value axis
                ...getQuadTriangles3(
                    this.graphViewportSize.width + XcGraphScene.VALUE_AXIS_OFFSET,
                    XcGraphScene.DATE_AXIS_SIZE + XcGraphScene.TIME_AXIS_SIZE,
                    Z(4),
                    XcGraphScene.VALUE_AXIS_SIZE,
                    this.graphViewportSize.height + XcGraphScene.HEAD_SIZE
                )
            ]
        );
        this.backObject.setData(
            XcWebGLObjectAttributeName.POSITION,
            getQuadTriangles3(
                0,
                0,
                Z(96),
                this.rootViewportSize.width,
                this.rootViewportSize.height
            )
        );
        this.overObject.setData(
            XcWebGLObjectAttributeName.POSITION,
            getQuadTriangles3(
                0,
                XcGraphScene.DATE_AXIS_SIZE + XcGraphScene.TIME_AXIS_SIZE,
                Z(64),
                this.graphViewportSize.width,
                this.graphViewportSize.height
            )
        );
    }


    private updateDeltaTime() {
        // minumum number of samples between two timestamps
        const numSamples = 10;
        // compute delta time
        const resolution = this.resolution >= second
            ? this.resolution / second
            : this.resolution;
        const f = 3;
        const g = 5;
        const nf = factorMultiplicity(resolution, f) % 2;
        const ng = factorMultiplicity(resolution, g) % 2;
        const n = Math.max(Math.max(nf * f, 1) * Math.max(ng * g, 1), numSamples);
        const deltaTime = n * this.resolution;
        // remove timestamp meshes, if delta time has changed
        if (this.deltaTime !== deltaTime) {
            this.deltaTime = deltaTime;
            this.removeMeshes(this.datestampMeshes);
            this.removeMeshes(this.timestampMeshes);
        }
    }


    private updateDeltaValue() {
        // compute new min and max values
        let minValue = 0;
        let maxValue = 1;
        this.dataSource.getGraphData().forEach(graphData =>
            graphData.slices.forEach(slice =>
                slice.values.forEach(value => {
                    minValue = Math.min(minValue, Math.floor(value));
                    maxValue = Math.max(maxValue, Math.ceil(value));
                })
            )
        );
        // value range has changed?
        if (minValue !== this.minValue || maxValue !== this.maxValue) {
            this.minValue = minValue;
            this.maxValue = maxValue;
            // remove all valuestamp meshes
            this.removeMeshes(this.valuestampMeshes);
            // update delta value
            if (this.maxValue - this.minValue > 0) {
                const raw = Math.trunc(Math.max(Math.abs(this.minValue), this.maxValue) / (XcGraphScene.NUM_VALUESTAMPS / 2));
                this.deltaValue = Math.pow(10, digits(raw)); // 1.0
                if ((this.deltaValue *= 0.5) >= raw) {       // 0.5 (1.0*0.5)
                    if ((this.deltaValue *= 0.4) >= raw) {   // 0.2 (1.0*0.5*0.4)
                        this.deltaValue *= 0.5;              // 0.1 (1.0*0.5*0.4*0.5)
                    }
                }
                this.minValue = floorBase(this.minValue, this.deltaValue);
                this.maxValue = ceilBase(this.maxValue, this.deltaValue);
            } else {
                this.deltaValue = 0;
            }
            // update camera
            this.graphCamera.top = this.maxValue;
            this.graphCamera.bottom = this.minValue;
            this.graphCamera.updateProjectionMatrix();
        }
    }


    private updateStamps(meshes: Map<number, Mesh>, min: number, max: number, delta: number, createMesh: (value: number) => Mesh, updateMesh: (value: number, mesh: Mesh) => void) {
        let value = min;
        while (value <= max) {
            updateMesh(
                value,
                meshes.get(value) || meshes.set(
                    value,
                    this.addMesh(
                        createMesh(value),
                        this.rootScene
                    )
                ).get(value)
            );
            value += delta;
        }
    }


    private updateTemporalStamps(meshes: Map<number, Mesh>, meshOffset: Vector2, delta: number, alignment: XcWebGLFontAlignment, timezoneOffset: number, createMesh: (value: number) => Mesh) {
        let alignmentOffset: number;
        let updateFont = () => {
            updateFont = NOP;
            alignmentOffset = XcWebGLFont.getAlignmentFactor(alignment) * this.sampleWidth;
        };
        // disregard timezone offset for deltas of one minute and below
        const timezoneOffsetDelta = delta > minute
            ? timezoneOffset
            : 0;
        // compute min and max values
        const min = floorBase(this.timeInterval.timeAt - timezoneOffsetDelta, delta) + timezoneOffsetDelta;
        const max = floorBase(this.timeInterval.timeTo - timezoneOffsetDelta, delta) + timezoneOffsetDelta + delta;
        // remove meshes outside of time interval (or after timezone has changed)
        this.removeMeshes(
            meshes, !this.timezoneOffset || this.timezoneOffset === timezoneOffset ? value => (value < min) || (value > max) : undefined
        );
        // create and update meshes within time interval
        this.updateStamps(
            meshes,
            min,
            max,
            delta,
            createMesh,
            (value, mesh) => {
                updateFont();
                const valueOffset = value - this.timeInterval.timeAt;
                const nowOffset = this.now() - this.timeInterval.timeTo;
                mesh.position.set(
                    meshOffset.x + this.timeToPixels(valueOffset - nowOffset) - this.sampleFraction + alignmentOffset,
                    meshOffset.y,
                    Z(8)
                );
            }
        );
    }


    private updateDatestamps(timezoneOffset: number) {
        if (this.datestampFont && this.deltaTime) {
            let updateFont = () => {
                updateFont = NOP;
                this.datestampFont.lineWidth = this.dataSource.datestampLineThickness;
                switch (this.dataSource.datestampLineStyle) {
                    case XcGraphLineStyle.NONE: this.datestampFont.lineHeight = 0; break;
                    case XcGraphLineStyle.AXIS: this.datestampFont.lineHeight = XcGraphScene.DATE_AXIS_SIZE - XcGraphScene.DATE_AXIS_OFFSET; break;
                    case XcGraphLineStyle.GRAPH: this.datestampFont.lineHeight = XcGraphScene.DATE_AXIS_SIZE + XcGraphScene.TIME_AXIS_SIZE + this.graphViewportSize.height; break;
                }
            };
            this.updateTemporalStamps(
                this.datestampMeshes,
                new Vector2(),
                Math.max(this.deltaTime, day),
                this.dataSource.datestampAlignment,
                timezoneOffset,
                value => {
                    updateFont();
                    return new XcShaderMesh(
                        this.datestampFont.createGeometry(
                            this.dateToString(value),
                            this.dataSource.datestampFontSize,
                            this.dataSource.datestampAlignment,
                            XcGraphScene.STAMP_PADDING
                        ),
                        this.resources.shaderMaterial,
                        this.resources.datestampColor
                    );
                }
            );
        }
    }


    private updateTimestamps(timezoneOffset: number) {
        if (this.timestampFont && this.deltaTime) {
            let updateFont = () => {
                updateFont = NOP;
                this.timestampFont.lineWidth = this.dataSource.timestampLineThickness;
                switch (this.dataSource.timestampLineStyle) {
                    case XcGraphLineStyle.NONE: this.timestampFont.lineHeight = 0; break;
                    case XcGraphLineStyle.AXIS: this.timestampFont.lineHeight = XcGraphScene.TIME_AXIS_SIZE - XcGraphScene.TIME_AXIS_OFFSET; break;
                    case XcGraphLineStyle.GRAPH: this.timestampFont.lineHeight = XcGraphScene.TIME_AXIS_SIZE + this.graphViewportSize.height; break;
                }
            };
            this.updateTemporalStamps(
                this.timestampMeshes,
                new Vector2(0, XcGraphScene.DATE_AXIS_SIZE),
                this.deltaTime,
                this.dataSource.timestampAlignment,
                timezoneOffset,
                value => {
                    updateFont();
                    return new XcShaderMesh(
                        this.timestampFont.createGeometry(
                            this.timeToString(value),
                            this.dataSource.timestampFontSize,
                            this.dataSource.timestampAlignment,
                            XcGraphScene.STAMP_PADDING
                        ),
                        this.resources.shaderMaterial,
                        this.resources.timestampColor
                    );
                }
            );
        }
    }


    private updateValuestamps() {
        if (this.valuestampFont && this.deltaValue) {
            let updateFont = () => {
                updateFont = NOP;
                this.valuestampFont.lineHeight = this.dataSource.valuestampLineThickness;
                switch (this.dataSource.valuestampLineStyle) {
                    case XcGraphLineStyle.NONE: this.valuestampFont.lineWidth = 0; break;
                    case XcGraphLineStyle.AXIS: this.valuestampFont.lineWidth = XcGraphScene.VALUE_AXIS_SIZE - XcGraphScene.VALUE_AXIS_OFFSET; break;
                    case XcGraphLineStyle.GRAPH: this.valuestampFont.lineWidth = XcGraphScene.VALUE_AXIS_SIZE + this.graphViewportSize.width; break;
                }
            };
            this.updateStamps(
                this.valuestampMeshes,
                this.minValue,
                this.maxValue,
                this.deltaValue,
                value => {
                    updateFont();
                    return new XcShaderMesh(
                        this.valuestampFont.createGeometry(
                            this.valueToString(value),
                            this.dataSource.valuestampFontSize,
                            XcWebGLFontAlignment.LEFT,
                            XcGraphScene.STAMP_PADDING
                        ),
                        this.resources.shaderMaterial,
                        this.resources.valuestampColor
                    );
                },
                (value, mesh) => {
                    mesh.position.set(
                        this.rootViewportSize.width,
                        XcGraphScene.DATE_AXIS_SIZE + XcGraphScene.TIME_AXIS_SIZE + this.valueToPixels(value - this.minValue),
                        Z(4)
                    );
                }
            );
        }
    }


    private updateGraphText() {
        if (this.textFont) {
            // remove name mesh, if name has changed
            if (this.name && this.name !== this.dataSource.name) {
                this.removeMesh(this.nameMesh);
                this.name = undefined;
            }
            // create name mesh, if necessary
            if (!this.name && this.dataSource.name) {
                this.name = this.dataSource.name;
                this.addMesh(
                    this.nameMesh = new XcShaderMesh(
                        this.textFont.createGeometry(
                            this.name,
                            this.dataSource.nameFontSize,
                            XcWebGLFontAlignment.LEFT
                        ),
                        this.resources.shaderMaterial,
                        this.resources.textColor
                    ),
                    this.rootScene
                );
            }
            // remove unit mesh, if unit has changed
            if (this.unit && this.unit !== this.dataSource.unit) {
                this.removeMesh(this.unitMesh);
                this.unit = undefined;
            }
            // create unit mesh, if necessary
            if (!this.unit && this.dataSource.unit) {
                this.unit = this.dataSource.unit;
                this.addMesh(
                    this.unitMesh = new XcShaderMesh(
                        this.textFont.createGeometry(
                            this.unit,
                            this.dataSource.unitFontSize,
                            XcWebGLFontAlignment.RIGHT
                        ),
                        this.resources.shaderMaterial,
                        this.resources.textColor
                    ),
                    this.rootScene
                );
            }
            // update positions
            this.nameMesh?.position.set(8, this.rootViewportSize.height - 20, Z(2));
            this.unitMesh?.position.set(this.rootViewportSize.width - XcGraphScene.VALUE_AXIS_SIZE - 8, this.rootViewportSize.height - 20, Z(2));
        }
    }


    private updateTimeInterval() {
        const timeTo = floorBase(this.now(), this.resolution);
        const timeAt = floorBase(timeTo - this.pixelsToTime(this.graphViewportSize.width), this.resolution);
        this.timeInterval = { timeAt, timeTo };
    }


    render(renderer: WebGLRenderer) {
        // root scene
        renderer.setViewport(this.rootViewportPosition.x, this.rootViewportPosition.y, this.rootViewportSize.width, this.rootViewportSize.height);
        renderer.render(this.rootScene, this.rootCamera);
        // graph scene
        renderer.setViewport(this.graphViewportPosition.x, this.graphViewportPosition.y, this.graphViewportSize.width, this.graphViewportSize.height);
        renderer.render(this.graphScene, this.graphCamera);
    }


    advance(_dt: number) {
        this.updateTimeInterval();
        // update temporal stamps
        const timezoneOffset = new Date(this.timeInterval.timeAt).getTimezoneOffset() * minute;
        this.updateDatestamps(timezoneOffset);
        this.updateTimestamps(timezoneOffset);
        this.timezoneOffset = timezoneOffset;
        // update value stamps
        this.updateValuestamps();
        // update name and unit
        this.updateGraphText();
        // update live offset visibility
        this.liveOffsetObject.setVisible(this.dataSource.indicateLiveOffset && this.translationDate !== undefined);
        // set anchor offset
        this.graphAnchor.position.set(-this.timeToPixels(this.now() - this.timeInterval.timeTo) - this.sampleFraction, 0, 0);
    }


    init(resources: XcGraphResources, serverTimeOffset: number) {
        if (!this.resources) {
            this.resources = resources;
            this.serverTimeOffset = serverTimeOffset;
            this.renewSubscription();

            // clipping planes
            const Z_NEAR = -1;
            const Z_FAR = 128;

            // prepare graph scene
            this.graphViewportPosition = new Vector2();
            this.graphViewportSize = new Vector2();
            this.graphCamera = new OrthographicCamera(0, 1, 1, 0, Z_NEAR, Z_FAR);
            this.graphScene = new Scene();
            this.graphAnchor = new Object3D();
            this.graphScene.add(this.graphAnchor);

            // prepare view scene
            this.rootViewportPosition = new Vector2();
            this.rootViewportSize = new Vector2();
            this.rootCamera = new OrthographicCamera(0, 1, 1, 0, Z_NEAR, Z_FAR);
            this.rootScene = new Scene();
            this.liveOffsetObject = new XcShaderObject(this.resources.shaderMaterial, this.rootScene, this.resources.liveOffsetColor);
            this.headObject = new XcShaderObject(this.resources.shaderMaterial, this.rootScene, this.resources.headColor);
            this.axesObject = new XcShaderObject(this.resources.shaderMaterial, this.rootScene, this.resources.axesColor);
            this.backObject = new XcShaderObject(this.resources.shaderMaterial, this.rootScene, this.resources.backColor);
            this.overObject = new XcShaderObject(this.resources.shaderMaterial, this.rootScene, this.resources.overColor);
            this.overObject.hide();

            // load label font
            XcWebGLFont.load(this.resources.font).subscribe(font => this.textFont = font);

            // load datestamp font
            XcWebGLFont.load(this.resources.font, XcGraphTimestampFont).subscribe((font: XcGraphTimestampFont) => {
                this.datestampFont = font;
                this.datestampFont.offset = new Vector2(0, 5);
            });

            // load timestamp font
            XcWebGLFont.load(this.resources.font, XcGraphTimestampFont).subscribe((font: XcGraphTimestampFont) => {
                this.timestampFont = font;
                this.timestampFont.offset = new Vector2(0, 5);
            });

            // load valuestamp font
            XcWebGLFont.load(this.resources.font, XcGraphValuestampFont).subscribe((font: XcGraphValuestampFont) => {
                this.valuestampFont = font;
                this.valuestampFont.offset = new Vector2(-XcGraphScene.VALUE_AXIS_SIZE + XcGraphScene.VALUE_AXIS_OFFSET, 5);
            });
        }
    }


    destroy() {
        if (this.resources) {
            this.resources = undefined;
            this.removeSubscription();

            // clear graph scene
            this.graphScene.remove(this.graphAnchor);
            this.graphs.forEach(graph => graph.dispose());
            this.graphs.clear();

            // clear view scene
            this.removeMesh(this.nameMesh);
            this.removeMesh(this.unitMesh);
            this.removeMeshes(this.datestampMeshes);
            this.removeMeshes(this.timestampMeshes);
            this.removeMeshes(this.valuestampMeshes);
            this.liveOffsetObject.dispose();
            this.headObject.dispose();
            this.axesObject.dispose();
            this.backObject.dispose();
            this.overObject.dispose();
        }
    }


    resize(left: number, bottom: number, width: number, height: number) {
        // dimensions
        this.x = left;
        this.y = bottom;
        this.width = width;
        this.height = height;

        // root viewport
        this.rootViewportPosition.x = this.x;
        this.rootViewportPosition.y = this.y;
        this.rootViewportSize.width = this.width;
        this.rootViewportSize.height = this.height;

        // root camera
        this.rootCamera.left = 0;
        this.rootCamera.right = this.rootViewportSize.width;
        this.rootCamera.top = this.rootViewportSize.height;
        this.rootCamera.bottom = 0;
        this.rootCamera.updateProjectionMatrix();

        // graph viewport
        this.graphViewportPosition.x = this.x;
        this.graphViewportPosition.y = this.y + XcGraphScene.DATE_AXIS_SIZE + XcGraphScene.TIME_AXIS_SIZE;
        this.graphViewportSize.width = this.width - XcGraphScene.VALUE_AXIS_SIZE;
        this.graphViewportSize.height = this.height - XcGraphScene.HEAD_SIZE - XcGraphScene.DATE_AXIS_SIZE - XcGraphScene.TIME_AXIS_SIZE;

        // graph camera
        this.graphCamera.left = 0;
        this.graphCamera.right = this.graphViewportSize.width;
        this.graphCamera.top = this.maxValue;
        this.graphCamera.bottom = this.minValue;
        this.graphCamera.updateProjectionMatrix();

        // adjust timestamp line height and remove meshes
        if (this.timestampFont) {
            this.timestampFont.lineHeight = this.graphViewportSize.height + XcGraphScene.TIME_AXIS_SIZE;
            this.removeMeshes(this.datestampMeshes);
            this.removeMeshes(this.timestampMeshes);
        }

        this.updateSampleFraction();
        this.updateAxes();
    }


    interaction(interaction: XcWebGLInteraction) {
        if (this.allowTranslating) {
            if (this.translatingInteraction) {
                // update translation offset
                const liveDate = +new Date() + this.serverTimeOffset;
                const liveTime = this.translationDate !== undefined ? liveDate - this.translationDate : 0;
                this.translationTime += this.pixelsToTime(this.translatingInteraction.mouse.x - interaction.mouse.x);
                this.translationTime = Math.min(this.translationTime, liveTime);
                // start and stop live update
                if (this.translationTime < liveTime) {
                    this.translationDate ??= liveDate;
                } else {
                    this.translationDate = undefined;
                    this.translationTime = 0;
                }
                // update last interaction
                this.translatingInteraction = interaction;
                this.translating = true;
                this.overObject.show();
            }
            if (interaction.mouse.down) {
                this.translatingInteraction = interaction;
            }
            if (interaction.mouse.up || interaction.mouse.leave) {
                this.translatingInteraction = undefined;
            }
            if (interaction.mouse.leave || !this.translatingInteraction) {
                this.translating = false;
                this.overObject.hide();
            }
            if (interaction.mouse.dblclick) {
                this.translationDate = undefined;
                this.translationTime = 0;
            }
        }

        if (this.allowHovering) {
            // compute offset in pixels to first whole sample (the addition of resolution is handles negative translation time values)
            const offset = fpint((this.translationTime % this.resolution + this.resolution) * this.sampleWidth) % this.sampleWidth;
            const timeAt = this.timeInterval.timeAt + floorBase(this.pixelsToTime(interaction.mouse.x + offset), this.resolution);
            if (timeAt !== this.hoveringAt.value || interaction.mouse.enter || interaction.mouse.leave) {
                this.hoveringAt.next(interaction.mouse.leave ? undefined : timeAt);
                this.getGraphInstance(
                    this.hoveringId,
                    XcGraphType.AREA
                ).update(
                    interaction.mouse.leave ? [] : [{ time: timeAt, values: [Number.MAX_SAFE_INTEGER] }],
                    this.timeInterval,
                    this.resolution,
                    this.sampleWidth,
                    Z(48)
                );
            }
        }
    }


    getRootViewport(): { position: Vector2; size: Vector2 } {
        return { position: this.rootViewportPosition, size: this.rootViewportSize };
    }


    getGraphViewport(): { position: Vector2; size: Vector2 } {
        return { position: this.graphViewportPosition, size: this.graphViewportSize };
    }


    getSampleWidth(): number {
        return this.sampleWidth;
    }


    setSampleWidth(value: number) {
        this.sampleWidth = value || XcGraphScene.DEFAULT_SAMPLE_WIDTH;
        this.updateSampleFraction();
    }


    getTranslationTime(): number {
        return this.translationTime;
    }


    setTranslationTime(value: number) {
        this.translationTime = value;
    }


    getTranslationDate(): number {
        return this.translationDate;
    }


    setTranslationDate(value: number) {
        this.translationDate = value;
    }


    getAllowTranslating(): boolean {
        return this.allowTranslating;
    }


    setAllowTranslating(value: boolean) {
        this.allowTranslating = value;
        if (!this.allowTranslating) {
            this.translatingInteraction = undefined;
            this.translating = false;
            this.overObject.hide();
        }
    }


    isTranslating(): boolean {
        return this.translating;
    }


    getAllowHovering(): boolean {
        return this.allowHovering;
    }


    setAllowHovering(value: boolean) {
        this.allowHovering = value;
        if (!this.allowHovering) {
            this.hoveringAt.next(undefined);
            const hoveringGraph = this.graphs.get(this.hoveringId);
            if (hoveringGraph) {
                hoveringGraph.dispose();
                this.graphs.delete(this.hoveringId);
            }
        }
    }
}



@Component({
    selector: 'xc-graph',
    templateUrl: './xc-graph.component.html',
    styleUrls: ['./xc-graph.component.scss'],
    imports: [XcWebGLComponent]
})
export class XcGraphComponent {
    private readonly authService = inject(AuthService);


    static readonly ROW_GAP = 12;
    static readonly COL_GAP = 12;

    private graphResources: XcGraphResources;
    private graphSceneOver: XcGraphScene;
    private graphScenes: XcGraphScene[] = [];

    private _dataSources: XcGraphDataSource[] = [];
    private _columns = 1;
    private _resized = false;
    private _initialized = false;

    @ViewChild(XcWebGLComponent, { static: true })
    webGL: XcWebGLComponent;

    @Output('xc-graph-resize')
    readonly resizeEmitter = new EventEmitter<any>();

    initFunction = this.init.bind(this);
    destroyFunction = this.destroy.bind(this);


    private render() {
        if (this.resized) {
            this.webGL.renderer.clear();
            this.graphScenes.forEach(graphScene => graphScene.render(this.webGL.renderer));
        }
    }


    private advance(dt: number) {
        if (this.initialized) {
            this.graphScenes.forEach(graphScene => graphScene.advance(dt));
            this.render();
        }
    }


    private init() {
        this._initialized = true;
        this.webGL.renderer.setClearColor(new Color(0), 0);
        this.graphResources = new XcGraphResources(0x88888d, 0x2a2a2d, 0x2a2a2d, 0x1a1a1d, 0x002c33, 0xeaeaed, 0x88888d, 0x88888d, 0x88888d, 'assets/zeta/opensans-regular.json');
        this.graphScenes.forEach(graphScene => graphScene.init(this.graphResources, this.authService.serverTimeOffset));
        this.start();
    }


    private destroy() {
        this.stop();
        this.graphScenes.forEach(graphScene => graphScene.destroy());
        this.graphResources.destroy();
    }


    resize() {
        if (this.webGL.width && this.webGL.height) {
            this._resized = true;
            const count = this.graphScenes.length;
            const colGap = XcGraphComponent.COL_GAP;
            const cols = this._columns;
            const cols1 = cols - 1;
            const colWidth = (this.webGL.width - cols1 * colGap) / cols;
            const colWidthGap = colWidth + colGap;
            const rowGap = XcGraphComponent.ROW_GAP;
            const rows = Math.ceil(count / cols);
            const rows1 = rows - 1;
            const rowHeight = (this.webGL.height - rows1 * rowGap) / rows;
            const rowHeightGap = rowHeight + rowGap;

            this.graphScenes.forEach((graphScene, idx) => {
                const x = colWidthGap * (idx % cols);
                const y = rowHeightGap * (rows1 - Math.floor(idx / cols));
                graphScene.resize(x, y, colWidth, rowHeight);
            });

            this.resizeEmitter.emit();
        }
    }


    interaction(interaction: XcWebGLInteraction) {
        if (interaction.mouse) {
            let graphSceneOver: XcGraphScene;
            for (const graphScene of this.graphScenes) {
                const viewport = graphScene.getRootViewport();
                const localX = interaction.mouse.x - viewport.position.x;
                const localY = interaction.mouse.y - viewport.position.y;
                if (localX > 0 && localX <= viewport.size.width && localY > 0 && localY <= viewport.size.height) {
                    if (this.graphSceneOver !== graphScene) {
                        interaction.mouse.enter = true;
                    }
                    interaction.mouse.x = localX;
                    interaction.mouse.y = localY;
                    graphScene.interaction(interaction);
                    graphSceneOver = graphScene;
                    break;
                }
            }
            if (this.graphSceneOver && this.graphSceneOver !== graphSceneOver) {
                const viewport = this.graphSceneOver.getRootViewport();
                interaction.mouse.x = Math.min(Math.max(interaction.mouse.x - viewport.position.x, 1), viewport.size.width);
                interaction.mouse.y = Math.min(Math.max(interaction.mouse.y - viewport.position.y, 1), viewport.size.height);
                interaction.mouse.leave = true;
                this.graphSceneOver.interaction(interaction);
            }
            if (graphSceneOver && interaction.mouse.ctrlKey && (graphSceneOver.isTranslating() || interaction.mouse.dblclick)) {
                for (const graphScene of this.graphScenes) {
                    if (graphScene.getAllowTranslating()) {
                        graphScene.setTranslationTime(graphSceneOver.getTranslationTime());
                        graphScene.setTranslationDate(graphSceneOver.getTranslationDate());
                    }
                }
            }
            this.graphSceneOver = graphSceneOver;
        }
    }


    updateSize() {
        this.webGL.updateSize();
    }


    start() {
        this.webGL.startRenderLoop(this.advance.bind(this));
        this.webGL.updateSize();
    }


    stop() {
        this.webGL.stopRenderLoop();
    }


    getName() {
        const count = this.dataSources.length;
        return count > 0
            ? this.dataSources[0].name + (count > 1 ? ' (+' + (count - 1) + ')' : '')
            : '';
    }


    downloadCSV() {
        const lines: string[] = [];
        this.graphScenes.forEach(graphScene => {
            graphScene.graphs.forEach(graph => {
                lines.push('# ' + graphScene.dataSource.name);
                lines.push('timestamp; value');
                lines.push(graph.timeValues.map(item => dateTimeString(item.time) + '; ' + item.value).join('\n'));
            });
        });
        downloadFile(lines.join('\n'), this.getName(), MimeTypes.csv);
    }


    downloadImage() {
        this.webGL.downloadFrame(this.getName());
    }


    getGraphScene(dataSource: XcGraphDataSource) {
        return this.graphScenes.find(graphScene => graphScene.dataSource === dataSource);
    }


    @Input('xc-graph-datasources')
    set dataSources(value: XcGraphDataSource[]) {
        this.graphScenes.forEach(graphScene => graphScene.destroy());
        this._dataSources = value || [];
        this.graphScenes = this.dataSources.map(dataSource => new XcGraphScene(dataSource));
        if (this.initialized) {
            this.graphScenes.forEach(graphScene => graphScene.init(this.graphResources, this.authService.serverTimeOffset));
            this.resize();
        }
    }


    get dataSources(): XcGraphDataSource[] {
        return this._dataSources;
    }


    @Input({alias: 'xc-graph-columns', transform: numberAttribute})
    set columns(value: number) {
        this._columns = value || 1;
        this.resize();
    }


    get columns(): number {
        return this._columns;
    }


    get resized(): boolean {
        return this._resized;
    }


    get initialized(): boolean {
        return this._initialized;
    }
}
