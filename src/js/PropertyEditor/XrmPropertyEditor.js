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
(function (XrmPropertyEditor, undefined) {
    "use strict";

    XrmPropertyEditor.entityMetadata = {};
    XrmPropertyEditor.metadata = [];

    XrmPropertyEditor.entity = null;
    XrmPropertyEditor.type = null;

    var currentHandler = null;
    var initialColumns = [
        { field: 'schemaName', caption: 'Schema Name', size: '20%', sortable: true, resizable: true, frozen: true }
    ];

    XrmPropertyEditor.RestoreInitialColumns = function () {
        var grid = XrmPropertyEditor.GetGrid();

        grid.columns = initialColumns;

        grid.refresh();
    };

    XrmPropertyEditor.GetEntity = function() {
        return w2ui.grid_toolbar.get("entitySelect").selected;
    }

    XrmPropertyEditor.GetEntityId = function() {
        return XrmPropertyEditor.entityMetadata[XrmPropertyEditor.GetEntity()]
    }

    XrmPropertyEditor.GetType = function() {
        return w2ui.grid_toolbar.get("type").selected;
    }

    function SetHandler() {
        if (XrmPropertyEditor.GetType() === "attributes") {
            currentHandler = AttributePropertyHandler;
        }
        else if (XrmPropertyEditor.GetType() === "entities") {
            currentHandler = EntityPropertyHandler;
        }
    }

    XrmPropertyEditor.errorHandler = function(error) {
        if(error.statusText) {
            w2alert(error.statusText);
        }
        else {
            w2alert(error);
        }

        XrmPropertyEditor.UnlockGrid();
    }

    XrmPropertyEditor.SchemaNameComparer = function(e1, e2) {
        if (e1.SchemaName < e2.SchemaName) {
            return -1;
        }

        if (e1.SchemaName > e2.SchemaName) {
            return 1;
        }

        return 0;
    }

    XrmPropertyEditor.GetGrid = function() {
        return w2ui.grid;
    }

    XrmPropertyEditor.LockGrid = function (message) {
        XrmPropertyEditor.GetGrid().lock(message, true);
    }

    XrmPropertyEditor.UnlockGrid = function () {
        XrmPropertyEditor.GetGrid().unlock();
    }

    XrmPropertyEditor.Publish = function() {
        var xml = "<importexportxml><entities><entity>" + XrmPropertyEditor.GetEntity().toLowerCase() + "</entity></entities></importexportxml>";

        var request = WebApiClient.Requests.PublishXmlRequest
            .with({
                payload: {
                    ParameterXml: xml
                }
            })
        return WebApiClient.Execute(request);
    }

    XrmPropertyEditor.GetRecord = function(records, selector) {
        for (var i = 0; i < records.length; i++) {
            var record = records[i];

            if (selector(record)) {
                return record;
            }
        }

        return null;
    }

    XrmPropertyEditor.SetSaveButtonDisabled = function (disabled) {
        var saveButton = w2ui.grid_toolbar.get("w2ui-save");
        saveButton.disabled = disabled;
        w2ui.grid_toolbar.refresh();
    }

    XrmPropertyEditor.GetAttributeById = function(id) {
        return XrmPropertyEditor.GetAttributeByProperty("MetadataId", id);
    }

    XrmPropertyEditor.GetByRecId = function (records, recid) {
        function selector(rec) {
            if (rec.recid === recid) {
                return true;
            }
            return false;
        }

        return XrmPropertyEditor.GetRecord(records, selector);
    };

    XrmPropertyEditor.GetAttributeByProperty = function(property, value) {
        for (var i = 0; i < XrmPropertyEditor.metadata.length; i++) {
            var attribute = XrmPropertyEditor.metadata[i];

            if (attribute[property] === value) {
                return attribute;
            }
        }

        return null;
    }

    function InitializeGrid (entities) {
        $('#grid').w2grid({
            name: 'grid',
            show: {
                toolbar: true,
                footer: true,
                toolbarSave: true,
                toolbarSearch: true
            },
            multiSearch: true,
            searches: [
                { field: 'schemaName', caption: 'Schema Name', type: 'text' }
            ],
            columns: initialColumns,
            onSave: function (event) {
                currentHandler.Save();
            },
            toolbar: {
                items: [
                    { type: 'menu-radio', id: 'entitySelect', img: 'icon-folder',
                        text: function (item) {
                            var text = item.selected;
                            var el = this.get('entitySelect:' + item.selected);

                            if (el) {
                                return 'Entity: ' + el.text;
                            }
                            else {
                                return "Choose entity";
                            }
                        },
                        items: []
                    },
                    { type: 'menu-radio', id: 'type', img: 'icon-folder',
                        text: function (item) {
                            var text = item.selected;
                            var el   = this.get('type:' + item.selected);
                            return 'Type: ' + el.text;
                        },
                        selected: 'attributes',
                        items: [
                            { id: 'attributes', text: 'Attributes', icon: 'fa-camera' },
                            { id: 'entities', text: 'Entities', icon: 'fa-picture' }
                        ]
                    },
                    { type: 'button', id: 'load', text: 'Load', img:'w2ui-icon-reload', onClick: function (event) {
                        var entity = XrmPropertyEditor.GetEntity();

                        if (!entity || !XrmPropertyEditor.GetType()) {
                            return;
                        }

                        SetHandler();
                        
                        XrmPropertyEditor.RestoreInitialColumns();
                        XrmPropertyEditor.LockGrid("Loading " + entity + " attributes");

                        currentHandler.Load();
                    } }
                ]
            }
        });

        XrmPropertyEditor.LockGrid("Loading entities");
    }

    function FillEntitySelector (entities) {
        entities = entities.sort(XrmPropertyEditor.SchemaNameComparer);
        var entitySelect = w2ui.grid_toolbar.get("entitySelect").items;

        for (var i = 0; i < entities.length; i++) {
            var entity = entities[i];

            entitySelect.push(entity.SchemaName);
            XrmPropertyEditor.entityMetadata[entity.SchemaName] = entity.MetadataId;
        }

        return entities;
    }

    function GetEntities() {
        var request = {
            entityName: "EntityDefinition",
            queryParams: "?$select=SchemaName,MetadataId&$filter=IsCustomizable/Value eq true"
        };

        return WebApiClient.Retrieve(request);
    }

    function RegisterReloadPrevention () {
        // Dashboards are automatically refreshed on browser window resize, we don't want to loose changes.
        window.onbeforeunload = function(e) {
            var records = XrmPropertyEditor.GetGrid().records;
            var unsavedChanges = false;

            for (var i = 0; i < records.length; i++) {
                var record = records[i];

                if (record.w2ui && record.w2ui.changes) {
                    unsavedChanges = true;
                    break;
                }
            }

            if (unsavedChanges) {
                var warning = "There are unsaved changes in the dashboard, are you sure you want to reload and discard changes?";
                e.returnValue = warning;
                return warning;
            }
        };
    }

    XrmPropertyEditor.Initialize = function() {
        InitializeGrid();
        RegisterReloadPrevention();

        GetEntities()
            .then(function(response) {
                return FillEntitySelector(response.value);
            })
            .then(function () {
                XrmPropertyEditor.UnlockGrid();
            })
            .catch(XrmPropertyEditor.errorHandler);
    }
} (window.XrmPropertyEditor = window.XrmPropertyEditor || {}));
