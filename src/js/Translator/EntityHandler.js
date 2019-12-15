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
(function (EntityHandler, undefined) {
    "use strict";

    function ApplyChanges(changes, labels) {
        for (var change in changes) {
            if (!changes.hasOwnProperty(change)) {
                continue;
            }

            // Skip empty labels
            if (!changes[change]) {
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

        var update = XrmTranslator.metadata;

        for (var i = 0; i < records.length; i++) {
            var record = records[i];

            if (record.w2ui && record.w2ui.changes) {
                var labels = null;

                if (record.schemaName === "Display Name") {
                    labels = update[XrmTranslator.GetComponent()].LocalizedLabels;
                } else if (record.schemaName === "Collection Name") {
                    labels = update.DisplayCollectionName.LocalizedLabels;
                }

                var changes = record.w2ui.changes;

                ApplyChanges(changes, labels);
            }
        }

        return update;
    }

    function FillTable () {
        var grid = XrmTranslator.GetGrid();
        grid.clear();

        var records = [];

        var entity = XrmTranslator.metadata;

        var displayNames = entity[XrmTranslator.GetComponent()].LocalizedLabels;
        var collectionNames = entity.DisplayCollectionName.LocalizedLabels;

        if (!displayNames && !collectionNames) {
            return;
        }

        var singular = {
            recid: XrmTranslator.metadata.MetadataId + "|1",
            schemaName: "Display Name"
        };

        var plural = {
            recid: XrmTranslator.metadata.MetadataId + "|2",
            schemaName: "Collection Name"
        };

        for (var i = 0; i < displayNames.length; i++) {
            var displayName = displayNames[i];

            singular[displayName.LanguageCode.toString()] = displayName.Label;
        }

        for (var j = 0; j < collectionNames.length; j++) {
            var collectionName = collectionNames[j];

            plural[collectionName.LanguageCode.toString()] = collectionName.Label;
        }

        records.push(singular);
        records.push(plural);

        XrmTranslator.AddSummary(records);
        grid.add(records);
        grid.unlock();
    }

    EntityHandler.Load = function() {
        var entityName = XrmTranslator.GetEntity();
        var entityMetadataId = XrmTranslator.entityMetadata[entityName];

        var request = {
            entityName: "EntityDefinition",
            entityId: entityMetadataId
        };

        return WebApiClient.Retrieve(request)
            .then(function(response) {
                XrmTranslator.metadata = response;

                FillTable();
            })
            .catch(XrmTranslator.errorHandler);
    }

    EntityHandler.Save = function() {
        XrmTranslator.LockGrid("Saving");

        var updates = GetUpdates();
        var entityUrl = WebApiClient.GetApiUrl() + "EntityDefinitions(" + XrmTranslator.GetEntityId() + ")";

        return WebApiClient.SendRequest("PUT", entityUrl, updates, [{key: "MSCRM.MergeLabels", value: "true"}])
        .then(function (response){
            XrmTranslator.LockGrid("Publishing");

            return XrmTranslator.Publish();
        })
        .then(function (response) {
            XrmTranslator.LockGrid("Reloading");

            return EntityHandler.Load();
        })
        .catch(XrmTranslator.errorHandler);
    }
} (window.EntityHandler = window.EntityHandler || {}));
