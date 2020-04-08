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
(function (FormMetaHandler, undefined) {
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

        var updates = [];

        for (var i = 0; i < records.length; i++) {
            var record = records[i];

            if (record.w2ui && record.w2ui.changes) {
                var view = XrmTranslator.GetAttributeByProperty("recid", record.recid);
                var labels = view.labels.Label.LocalizedLabels;

                var changes = record.w2ui.changes;

                ApplyChanges(changes, labels);
                updates.push(view);
            }
        }

        return updates;
    }

    function FillTable () {
        var grid = XrmTranslator.GetGrid();
        grid.clear();

        var records = [];

        for (var i = 0; i < XrmTranslator.metadata.length; i++) {
            var form = XrmTranslator.metadata[i];

            var displayNames = form.labels.Label.LocalizedLabels;

            if (!displayNames || displayNames.length === 0) {
                continue;
            }

            var record = {
               recid: form.recid,
               schemaName: "Form"
            };

            for (var j = 0; j < displayNames.length; j++) {
                var displayName = displayNames[j];

                record[displayName.LanguageCode.toString()] = displayName.Label;
            }

            records.push(record);
        }

        XrmTranslator.AddSummary(records);
        grid.add(records);
        grid.unlock();
    }

    FormMetaHandler.Load = function() {
        var entityName = XrmTranslator.GetEntity();

        var entityMetadataId = XrmTranslator.entityMetadata[entityName];

        var formRequest = {
            entityName: "systemform",
            queryParams: "?$filter=objecttypecode eq '" + entityName.toLowerCase() + "' and iscustomizable/Value eq true and formactivationstate eq 1"
        };

        if (entityName.toLowerCase() === "dashboard") {
            formRequest.queryParams = "?$filter=formactivationstate eq 1 and iscustomizable/Value eq true and (type eq 0 or type eq 10)"
        }

        return WebApiClient.Retrieve(formRequest)
            .then(function(response) {
                var forms = response.value;
                var requests = [];

                for (var i = 0; i < forms.length; i++) {
                    var form = forms[i];

                    var retrieveLabelsRequest = WebApiClient.Requests.RetrieveLocLabelsRequest
                        .with({
                            urlParams: {
                                EntityMoniker: "{'@odata.id':'systemforms(" + form.formid + ")'}",
                                AttributeName: "'name'",
                                IncludeUnpublished: true
                            }
                        })

                    var prop = WebApiClient.Promise.props({
                        recid: form.formid,
                        labels: WebApiClient.Execute(retrieveLabelsRequest)
                    });

                    requests.push(prop);
                }

                return WebApiClient.Promise.all(requests);
            })
            .then(function(responses) {
                    var forms = responses;
                    XrmTranslator.metadata = forms;

                    FillTable();
            })
            .catch(XrmTranslator.errorHandler);
    }

    FormMetaHandler.Save = function() {
        XrmTranslator.LockGrid("Saving");

        var updates = GetUpdates();
        var requests = [];

        for (var i = 0; i < updates.length; i++) {
            var update = updates[i];

            var request = WebApiClient.Requests.SetLocLabelsRequest
                .with({
                    payload: {
                        Labels: update.labels.Label.LocalizedLabels,
                        EntityMoniker: {
                            "@odata.type": "Microsoft.Dynamics.CRM.systemform",
                            formid: update.recid
                        },
                        AttributeName: "name"
                    }
                });

            requests.push(request);
        }

        return WebApiClient.Promise.resolve(requests)
            .each(function(request) {
                return WebApiClient.Execute(request);
            })
            .then(function (response){
                XrmTranslator.LockGrid("Publishing");
                var entityName = XrmTranslator.GetEntity();
                if (entityName.toLowerCase() === "dashboard") {
                    return XrmTranslator.PublishDashboard(updates);
                }
                else {
                    return XrmTranslator.Publish();
                }
            })
            .then(function(response) {
                if (XrmTranslator.GetEntity().toLowerCase() === "dashboard") {
                    return XrmTranslator.AddToSolution(updates.map(u => u.recid), XrmTranslator.ComponentType.SystemForm, true, true);
                }
                else {
                    return XrmTranslator.AddToSolution(updates.map(u => u.recid), XrmTranslator.ComponentType.SystemForm);
                }
            })
            .then(function(response) {
                return XrmTranslator.ReleaseLockAndPrompt();
            })
            .then(function (response) {
                XrmTranslator.LockGrid("Reloading");

                return FormMetaHandler.Load();
            })
            .catch(XrmTranslator.errorHandler);
    }
} (window.FormMetaHandler = window.FormMetaHandler || {}));
