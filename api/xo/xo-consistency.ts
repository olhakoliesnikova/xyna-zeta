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
import { ApiService } from '../api.service';
import { XoArray, XoArrayClassInterface, XoObject, XoObjectClassInterface, XoSanitizePropertyKey } from './xo-object';
import { XoStructureArray, XoStructureObject } from './xo-structure';
import { XynaOptions, ZetaEnvironment } from '../zeta-environment.interfaces';


export class XoConsistencyCheck {
    private static readonly objectClasses = new Array<XoObjectClassInterface>();
    private static readonly arrayClasses = new Array<XoArrayClassInterface>();

    private static messageWarning(clazz: XoObjectClassInterface, message: string) {
        console.warn('[XO] ' + clazz.fqn + ': ' + message);
    }

    private static propertyWarning(clazz: XoObjectClassInterface, property: string, message: string) {
        XoConsistencyCheck.messageWarning(clazz, 'property "' + property + '": ' + message);
    }

    static run(apiService: ApiService, config: XynaOptions) {
        if (config.consistencyCheck) {
            console.log('xo consistency check...');
            XoConsistencyCheck.objectClasses
                // filter out classes without rtc, if no xo rtc is given
                .filter(clazz => config.runtimeContext || clazz.rtc)
                // get structure for each class separately, because if a single datatype does not exist on the server, the whole request will fail
                .forEach(clazz => apiService.getStructure(config.runtimeContext, [clazz])
                    .get(clazz)
                    .subscribe({
                        next: structure => {
                            const instance = new clazz();
                            Array.from(instance.properties.keys())
                                .filter(propertyKey => !instance.transientProperties.has(propertyKey))
                                .forEach(propertykey => {
                                    const sanitizedPropertyKey = XoSanitizePropertyKey(propertykey);
                                    const childStructure = structure.children.find(child => child.name === sanitizedPropertyKey);
                                    if (childStructure) {
                                        const childClazz = instance.properties.get(propertykey);
                                        if (childClazz) {
                                            if (Object.prototype.isPrototypeOf.call(XoObject, childClazz.prototype) && childStructure instanceof XoStructureArray) {
                                                XoConsistencyCheck.propertyWarning(clazz, propertykey, 'incompatible type! (server "List" != client "Object")');
                                            }
                                            if (Object.prototype.isPrototypeOf.call(XoArray, childClazz.prototype) && childStructure instanceof XoStructureObject) {
                                                XoConsistencyCheck.propertyWarning(clazz, propertykey, 'incompatible type! (server "Object" != client "List")');
                                            }
                                            if (!childClazz.fqn.equals(childStructure.typeFqn)) {
                                                XoConsistencyCheck.propertyWarning(clazz, propertykey, 'incompatible fqn! (server ' + childStructure.typeFqn + ' != client ' + childClazz.fqn + ')');
                                            }
                                        }
                                    } else {
                                        XoConsistencyCheck.propertyWarning(clazz, propertykey, 'not available');
                                    }
                                });
                        },
                        error: () => XoConsistencyCheck.messageWarning(clazz, 'missing on the server!')
                    })
                );
        }
    }

    static addObjectClass(clazz: XoObjectClassInterface) {
        XoConsistencyCheck.objectClasses.push(clazz);
    }

    static addArrayClass(clazz: XoArrayClassInterface) {
        XoConsistencyCheck.arrayClasses.push(clazz);
    }
}
