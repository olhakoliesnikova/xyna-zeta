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
/**
 * Defines sorting direction of data as being either ascending or descending
 */
export enum XcSortDirection {
    none,
    asc,
    dsc
}


export function XcSortDirectionFromString(value: string) {
    if (value.startsWith('a')) {
        return XcSortDirection.asc;
    }
    if (value.startsWith('d')) {
        return XcSortDirection.dsc;
    }
    return XcSortDirection.none;
}


export function XcSortPredicate<T>(sortDirection: XcSortDirection, accessor: (t: T) => any): (a: T, b: T) => number {
    let direction = 0;
    if (sortDirection === XcSortDirection.asc) {
        direction = 1;
    }
    if (sortDirection === XcSortDirection.dsc) {
        direction = -1;
    }

    return (a: T, b: T) => {
        const acca = accessor(a);
        const accb = accessor(b);

        // string comparison
        if (isNaN(acca) || isNaN(accb)) {
            return (acca === accb)
                ? 0
                : (acca < accb ? -1 : 1) * direction;
        }

        // number comparison
        const vala = Number.parseFloat(acca);
        const valb = Number.parseFloat(accb);

        return (vala === valb)
            ? 0
            : (vala < valb ? -1 : 1) * direction;
    };
}

export function XcSortDirectionToLabel(dir: XcSortDirection): string {
    switch (dir) {
        case XcSortDirection.asc:
            return 'ascending';
        case XcSortDirection.dsc:
            return 'descending';
        default:
            return 'none';
    }
}
