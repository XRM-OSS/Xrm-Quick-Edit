/* @preserve
 * MIT License
 *
 * Copyright (c) 2017 Florian Krönert
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
*/
(function (WebResourceHandler, undefined) {
    "use strict";

    var idSeparator = "|";
    var lcidRegex = /([0-9]+)\.js/i;

    function GetGroupKey (id) {
        var separatorIndex = id.indexOf(idSeparator);

        if (separatorIndex === -1) {
            return id;
        }

        return id.substring(0, separatorIndex);
    }

    function GetUpdates(records) {
        var updates = [];

        for (var i = 0; i < records.length; i++) {
            var record = records[i];
            var groupKey = GetGroupKey(record.recid);

            if (record.w2ui && record.w2ui.changes) {
                var group = XrmTranslator.metadata[groupKey];
                var property = record.schemaName;
                
                var changes = record.w2ui.changes;

                for (var change in changes) {
                    if (!changes.hasOwnProperty(change)) {
                        continue;
                    }

                    var updateRecord = group.find(function(w) { return w.__lcid === change }) || updates.find(function(w) { return w.__lcid === change });
                    
                    // In this case, we need to create a new web resource
                    if (!updateRecord) {
                        var baseLanguageRecord = group.find(function(w) { return w.__lcid == XrmTranslator.baseLanguage });

                        updateRecord = {
                            __lcid: change,
                            webresourceid: undefined,
                            name: baseLanguageRecord ? baseLanguageRecord.name.replace(XrmTranslator.baseLanguage.toString(), change) : groupKey + change + ".js",
                            content: baseLanguageRecord ? Object.keys(baseLanguageRecord.content).reduce(function(all, cur) { all[cur] = null; return all; }, {}) : { }
                        }
                    }

                    var value = changes[change];
                    updateRecord.content[property] = value;

                    if (updates.indexOf(updateRecord) === -1) {
                        updates.push(updateRecord);
                    }
                }
            }
        }

        return updates;
    }

    function FillKey(record, property, group) {
        var keyRecord = {
            recid: record.recid + idSeparator + property,
            schemaName: property
        };

        for (var i = 0; i < group.length; i++) {
            var resource = group[i];

            var value = resource.content[property];

            if (!resource.__lcid) {
                continue;
            }
            
            keyRecord[resource.__lcid] = value;
        }

        record.w2ui.children.push(keyRecord);
    }

    function FillTable () {
        var grid = XrmTranslator.GetGrid();
        grid.clear();

        var records = [];

        var groups = Object.keys(XrmTranslator.metadata);

        for (var i = 0; i < groups.length; i++) {
            var key = groups[i];
            var group = XrmTranslator.metadata[key];

            var record = {
                recid: key,
                schemaName: key,
                w2ui: {
                    editable: false,
                    children: []
                }
            };

            var properties = Array.from(new Set(group.map(function(g) { return Object.keys(g.content); }).reduce(function(all, cur) { return all.concat(cur); }, [])));

            for (var j = 0; j < properties.length; j++) {
                var property = properties[j];

                FillKey(record, property, group);
            }

            records.push(record);
        }

        XrmTranslator.AddSummary(records);
        grid.add(records);
        grid.unlock();
    }

    WebResourceHandler.Load = function() {
        XrmTranslator.GetBaseLanguage()
        .then(function(baseLanguage) {
            var request = {
                overriddenSetName: "webresourceset",
                queryParams: "?$select=webresourceid,name,content&$filter=contains(name, '" + baseLanguage + ".js')"
            };

            return WebApiClient.Promise.all([baseLanguage, WebApiClient.Retrieve(request)]);
        })
        .then(function(r) {
            var baseLanguage = r[0];
            var records = r[1].value;

            return WebApiClient.Promise.all(records.map(function(rec) {
                var groupingKey = rec.name.substr(0, rec.name.indexOf(baseLanguage));
                
                return WebApiClient.Retrieve({ overriddenSetName: "webresourceset", queryParams: "?$select=webresourceid,name,content&$filter=contains(name, '" + groupingKey + "')"})
                .then(function (g) {
                    return { 
                        key: groupingKey,
                        value: g.value.map(function(w) {
                            try {
                                var lcidMatches = w.name.match(lcidRegex);
                                return Object.assign(w, { content: JSON.parse(atob(w.content)), __lcid: lcidMatches.length > 1 ? lcidMatches[1] : undefined });
                            }
                            catch {
                                return {};
                            }
                        }) 
                    };
                });
            }));
        })
        .then(function(responses) {
            var groupedResponses = responses.reduce(function(all, cur) {
                all[cur.key] = cur.value;
                return all;
            }, {});

            XrmTranslator.metadata = groupedResponses;

            FillTable();
        })
        .catch(XrmTranslator.errorHandler);
    }

    WebResourceHandler.Save = function() {
        XrmTranslator.LockGrid("Saving");

        var records = XrmTranslator.GetAllRecords();
        var updates = GetUpdates(records);

        return WebApiClient.Promise.resolve(updates)
        .mapSeries(function(webresource) {
            var content = btoa(JSON.stringify(webresource.content));

            if (webresource.webresourceid) {
                return WebApiClient.Update({
                    overriddenSetName: "webresourceset",
                    entityId: webresource.webresourceid,
                    entity: {
                        content: content
                    }
                })
                .then(function() {
                    return webresource.webresourceid;
                });
            }
            else {
                return WebApiClient.Create({
                    overriddenSetName: "webresourceset",
                    entity: {
                        name: webresource.name,
                        displayname: webresource.name,
                        content: content,
                        webresourcetype: 3
                    }
                })
                .then(function(response) {
                    // "Cut out" created Guid, response format is http://orgname/api/data/v8.0/webresourceset(49f117b8-287a-ea11-8106-0050568e4745)
                    return response.substr(response.length - 37, 36)
                });
            }
        })
        .then(function (ids){
            XrmTranslator.LockGrid("Publishing");

            return XrmTranslator.PublishWebResources(ids)
            .then(function() {
                return ids;
            });
        })
        .then(function(ids) {
            // WebResources can't be added with defined componenent settings or DoNotIncludeSubcomponents flag set to true
            return XrmTranslator.AddToSolution(ids, XrmTranslator.ComponentType.WebResource, true, true);
        })
        .then(function(response) {
            return XrmTranslator.ReleaseLockAndPrompt();
        })
        .then(function (response) {
            XrmTranslator.LockGrid("Reloading");

            return WebResourceHandler.Load();
        })
        .catch(XrmTranslator.errorHandler);
    }
} (window.WebResourceHandler = window.WebResourceHandler || {}));
