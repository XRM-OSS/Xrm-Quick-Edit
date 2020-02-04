(function (ChartHandler, undefined) {
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
                var chart = XrmTranslator.GetAttributeByProperty("recid", record.recid);
                var labels = chart.labels.Label.LocalizedLabels;

                var changes = record.w2ui.changes;

                ApplyChanges(changes, labels);
                updates.push(chart);
            }
        }

        return updates;
    }
    function FillTable() {
        var grid = XrmTranslator.GetGrid();
        grid.clear();

        var records = [];

        for (var i = 0; i < XrmTranslator.metadata.length; i++) {
            var chart = XrmTranslator.metadata[i];

            var displayNames = chart.labels.Label.LocalizedLabels;

            if (!displayNames || displayNames.length === 0) {
                continue;
            }

            var record = {
                recid: chart.recid,
                schemaName: "Chart"
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

    ChartHandler.Load = function () {
        var entityName = XrmTranslator.GetEntity();

        var entityMetadataId = XrmTranslator.entityMetadata[entityName];

        var queryRequest = {
            entityName: "savedqueryvisualization",
            queryParams: "?$filter=primaryentitytypecode eq '" + entityName.toLowerCase() + "' and iscustomizable/Value eq true&$orderby=savedqueryvisualizationid asc"
        };

        var languages = XrmTranslator.installedLanguages.LocaleIds;
        var initialLanguage = XrmTranslator.userSettings.uilanguageid;

        return WebApiClient.Retrieve(queryRequest)
            .then(function (response) {

                var charts = response.value;
                var requests = [];

                for (var i = 0; i < charts.length; i++) {
                    var chart = charts[i];

                    var retrieveLabelsRequest = WebApiClient.Requests.RetrieveLocLabelsRequest
                        .with({
                            urlParams: {
                                EntityMoniker: "{'@odata.id':'savedqueryvisualizations(" + chart.savedqueryvisualizationid + ")'}",
                                AttributeName: "'name'",
                                IncludeUnpublished: true
                            }
                        })

                    var prop = WebApiClient.Promise.props({
                        recid: chart.savedqueryvisualizationid,
                        labels: WebApiClient.Execute(retrieveLabelsRequest)
                    });

                    requests.push(prop);
                }

                return WebApiClient.Promise.all(requests);
            })
            .then(function (responses) {
                var charts = responses;
                XrmTranslator.metadata = charts;

                FillTable();
            })
            .catch(XrmTranslator.errorHandler);
    }

    ChartHandler.Save = function () {
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
                            "@odata.type": "Microsoft.Dynamics.CRM.savedqueryvisualization",
                            savedqueryvisualizationid: update.recid
                        },
                        AttributeName: "name"
                    }
                });

            requests.push(request);
        }

        return WebApiClient.Promise.resolve(requests)
            .each(function (request) {
                return WebApiClient.Execute(request);
            })
            .then(function (response) {
                XrmTranslator.LockGrid("Publishing");

                return XrmTranslator.Publish();
            })
            .then(function(response) {
                return XrmTranslator.AddToSolution(updates.map(u => u.recid), XrmTranslator.ComponentType.SavedQueryVisualization);
            })
            .then(function (response) {
                XrmTranslator.LockGrid("Reloading");

                return ChartHandler.Load();
            })
            .catch(XrmTranslator.errorHandler);
    }

}(window.ChartHandler = window.ChartHandler || {}));
