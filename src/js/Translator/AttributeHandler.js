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
(function (AttributeHandler, undefined) {
    "use strict";

    function ApplyChanges(changes, labels) {
        for (var change in changes) {
            if (!changes.hasOwnProperty(change)) {
                continue;
            }

            for (var i = 0; i < labels.length; i++) {
                var label = labels[i];

                if (label.LanguageCode == change) {
                    label.Label = changes[change];
                    label.HasChanged = true;

                    break;
                }

                // Did not find label for this language
                if (i === labels.length - 1) {
                    labels.push({ LanguageCode: change, Label: changes[change] })
                }
            }
        }
    }

    function GetUpdates() {
        var records = XrmTranslator.GetGrid().records;

        var updates = [];

        for (var i = 0; i < records.length; i++) {
            var record = records[i];

            if (record.w2ui && record.w2ui.changes) {
                var attribute = XrmTranslator.GetAttributeById (record.recid);
                var labels = attribute[XrmTranslator.GetComponent()].LocalizedLabels;

                var changes = record.w2ui.changes;

                ApplyChanges(changes, labels);
                updates.push(attribute);
            }
        }

        return updates;
    }

    function FillTable () {
        var grid = XrmTranslator.GetGrid();
        grid.clear();

        var records = [];

        for (var i = 0; i < XrmTranslator.metadata.length; i++) {
            var attribute = XrmTranslator.metadata[i];

            var displayNames = attribute[XrmTranslator.GetComponent()].LocalizedLabels;

            if (!displayNames || displayNames.length === 0) {
                continue;
            }

            var record = {
               recid: attribute.MetadataId,
               schemaName: attribute.SchemaName
            };

            for (var j = 0; j < displayNames.length; j++) {
                var displayName = displayNames[j];

                record[displayName.LanguageCode.toString()] = displayName.Label;
            }

            records.push(record);
        }

        grid.add(records);
        grid.unlock();
    }

    AttributeHandler.Load = function() {
        var entityName = XrmTranslator.GetEntity();

        var entityMetadataId = XrmTranslator.entityMetadata[entityName];

        var request = {
            entityName: "EntityDefinition",
            entityId: entityMetadataId,
            queryParams: "/Attributes?$filter=IsCustomizable/Value eq true"
        };

        return WebApiClient.Retrieve(request)
            .then(function(response) {
                var attributes = response.value.sort(XrmTranslator.SchemaNameComparer);
                XrmTranslator.metadata = attributes;

                FillTable();
            })
            .catch(XrmTranslator.errorHandler);
    }

    AttributeHandler.Save = function() {
        XrmTranslator.LockGrid("Saving");

        var updates = GetUpdates();

        var requests = [];
        var entityUrl = WebApiClient.GetApiUrl() + "EntityDefinitions(" + XrmTranslator.GetEntityId() + ")/Attributes(";

        for (var i = 0; i < updates.length; i++) {
            var update = updates[i];
            var url = entityUrl + update.MetadataId + ")";

            var request = {
                method: "PUT",
                url: url,
                attribute: update,
                headers: [{key: "MSCRM.MergeLabels", value: "true"}]
            };
            requests.push(request);
        }

        return WebApiClient.Promise.resolve(requests)
            .each(function(request) {
                return WebApiClient.SendRequest(request.method, request.url, request.attribute, request.headers);
            })
            .then(function (response){
                XrmTranslator.LockGrid("Publishing");

                return XrmTranslator.Publish();
            })
            .then(function (response) {
                XrmTranslator.LockGrid("Reloading");

                return AttributeHandler.Load();
            })
            .catch(XrmTranslator.errorHandler);
    }
} (window.AttributeHandler = window.AttributeHandler || {}));
