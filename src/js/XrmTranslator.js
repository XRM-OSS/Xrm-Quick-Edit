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
(function (XrmTranslator, undefined) {
    "use strict";
    
    XrmTranslator.entityMetadata = {};
    XrmTranslator.metadata = [];
    
    XrmTranslator.entity = null;
    XrmTranslator.type = null;

    // We need those for the FormHandleer, uilanguageid is current user language, formXml only contains labels for this locale by default
    XrmTranslator.userId = null;
    XrmTranslator.userSettings = null;
    XrmTranslator.installedLanguages = null;
    
    var currentHandler = null;
    
    function ExpandRecord (record) {
        XrmTranslator.GetGrid().expand(record.recid);
    }
    
    function CollapseRecord (record) {
        XrmTranslator.GetGrid().collapse(record.recid);
    }
    
    function ToggleExpandCollapse (expand) {
        for (var i = 0; i < XrmTranslator.GetGrid().records.length; i++) {
            var record = XrmTranslator.GetGrid().records[i];
            
            if (!record.w2ui || !record.w2ui.children) {
                continue;
            }
            
            if (expand) {
                ExpandRecord(record);
            } else {
                CollapseRecord(record);
            }
        }
    }
    
    XrmTranslator.GetEntity = function() {
        return w2ui.grid_toolbar.get("entitySelect").selected;
    }
    
    XrmTranslator.GetEntityId = function() {
        return XrmTranslator.entityMetadata[XrmTranslator.GetEntity()]
    }
    
    XrmTranslator.GetType = function() {
        return w2ui.grid_toolbar.get("type").selected;
    }
    
    function SetHandler() {
        if (XrmTranslator.GetType() === "attributes") {
            currentHandler = AttributeHandler;
        }
        else if (XrmTranslator.GetType() === "options") {
            currentHandler = OptionSetHandler;
        }
        else if (XrmTranslator.GetType() === "forms") {
            currentHandler = FormHandler;
        }
        else if (XrmTranslator.GetType() === "views") {
            currentHandler = ViewHandler;
        }
        else if (XrmTranslator.GetType() === "formMeta") {
            currentHandler = FormMetaHandler;
        }
        else if (XrmTranslator.GetType() === "entityMeta") {
            currentHandler = EntityHandler;
        }
    }
    
    XrmTranslator.errorHandler = function(error) {
        if(error.statusText) {
            w2alert(error.statusText);
        }
        else {
            w2alert(error);
        }
        
        XrmTranslator.UnlockGrid();
    }
    
    XrmTranslator.SchemaNameComparer = function(e1, e2) {
        if (e1.SchemaName < e2.SchemaName) {
            return -1;
        }
        
        if (e1.SchemaName > e2.SchemaName) {
            return 1;
        }
        
        return 0;
    }
    
    XrmTranslator.GetGrid = function() {
        return w2ui.grid;
    }
    
    XrmTranslator.LockGrid = function (message) {
        XrmTranslator.GetGrid().lock(message, true);
    }
    
    XrmTranslator.UnlockGrid = function () {
        XrmTranslator.GetGrid().unlock();
    }
    
    XrmTranslator.Publish = function() {
        var xml = "<importexportxml><entities><entity>" + XrmTranslator.GetEntity().toLowerCase() + "</entity></entities></importexportxml>";
        
        var request = WebApiClient.Requests.PublishXmlRequest
            .with({
                payload: {
                    ParameterXml: xml
                }
            })
        return WebApiClient.Execute(request);
    }
    
    XrmTranslator.GetRecord = function(records, selector) {
        for (var i = 0; i < records.length; i++) {
            var record = records[i];
            
            if (selector(record)) {
                return record;
            }
        }
        
        return null;
    }
    
    XrmTranslator.SetSaveButtonDisabled = function (disabled) {
        var saveButton = w2ui.grid_toolbar.get("w2ui-save");
        saveButton.disabled = disabled;
        w2ui.grid_toolbar.refresh();
    }
    
    XrmTranslator.GetAttributeById = function(id) {
        return XrmTranslator.GetAttributeByProperty("MetadataId", id);
    }
    
    XrmTranslator.GetByRecId = function (records, recid) {
        function selector(rec) {
            if (rec.recid === recid) {
                return true;
            }
            return false;
        }
        
        return XrmTranslator.GetRecord(records, selector);
    };
    
    XrmTranslator.GetAttributeByProperty = function(property, value) {
        for (var i = 0; i < XrmTranslator.metadata.length; i++) {
            var attribute = XrmTranslator.metadata[i];
            
            if (attribute[property] === value) {
                return attribute;
            }
        }
        
        return null;
    }
    
    XrmTranslator.ApplyFindAndReplace = function (selected, results) {
        var grid = XrmTranslator.GetGrid();
        var savable = false;
        
        for (var i = 0; i < selected.length; i++) {
            var select = selected[i];
            
            var result = XrmTranslator.GetByRecId(results, select);
            var record = XrmTranslator.GetByRecId(grid.records, result.recid);
            
            if (!record) {
                continue;
            }
            
            if (!record.w2ui) {
                record["w2ui"] = {};
            }
            
            if (!record.w2ui.changes) {
                record.w2ui["changes"] = {};
            }
            
            record.w2ui.changes[result.column] = result.replaced;
            savable = true;
            grid.refreshRow(record.recid);
        }
        
        if (savable) {
            XrmTranslator.SetSaveButtonDisabled(false);
        }
    }
    
    function ShowFindAndReplaceResults (results) {
        if (!w2ui.findAndReplaceGrid) {
            var grid = { 
                name: 'findAndReplaceGrid',
                show: { selectColumn: true },
                multiSelect: true,
                columns: [
                    { field: 'schemaName', caption: 'Schema Name', size: '25%', sortable: true, searchable: true },
                    { field: 'column', caption: 'Column', size: '25%', sortable: true, searchable: true },
                    { field: 'current', caption: 'Current Text', size: '25%', sortable: true, searchable: true },
                    { field: 'replaced', caption: 'Replaced Text', size: '25%', sortable: true, searchable: true }
                ],
                records: results
            };

            $(function () {
                // initialization in memory
                $().w2grid(grid);
            });
        }

        w2popup.open({
            title   : 'Apply Find and Replace',
            buttons   : '<button class="w2ui-btn" onclick="w2popup.close();">Cancel</button> '+
                        '<button class="w2ui-btn" onclick="XrmTranslator.ApplyFindAndReplace(w2ui.findAndReplaceGrid.getSelection(), w2ui.findAndReplaceGrid.records); w2popup.close();">Apply</button>',
            width   : 900,
            height  : 600,
            showMax : true,
            body    : '<div id="main" style="position: absolute; left: 5px; top: 5px; right: 5px; bottom: 5px;"></div>',
            onOpen  : function (event) {
                event.onComplete = function () {
                    $('#w2ui-popup #main').w2render('findAndReplaceGrid');
                    w2ui.findAndReplaceGrid.selectAll();
                };
            },
            onToggle: function (event) {
                $(w2ui.findAndReplaceGrid.box).hide();
                event.onComplete = function () {
                    $(w2ui.findAndReplaceGrid.box).show();
                    w2ui.findAndReplaceGrid.resize();
                }
            }
        });
    }
    
    function FindRecords(find, replace, regex, ignoreCase, column) {
        var records = XrmTranslator.GetGrid().records;
        var findings = [];
        
        for (var i = 0; i < records.length; i++) {
            var record = records[i];
            var value = record[column];
            
            if (value !== null && value.indexOf(find) !== -1) {
                findings.push({
                    recid: record.recid,
                    schemaName: record.schemaName,
                    column: column,
                    current: value,
                    replaced: value.replace(find, replace)
                });
            }
        }
        
        ShowFindAndReplaceResults(findings);
    }
    
    function OpenFindAndReplaceDialog () {
        if (!w2ui.findAndReplace) {
            var languageLcids = [];
            var availableLanguages = XrmTranslator.installedLanguages.LocaleIds;
            
            for (var i = 0; i < availableLanguages.length; i++) {
                languageLcids.push(availableLanguages[i].toString());
            }
            
            $().w2form({
                name: 'findAndReplace',
                style: 'border: 0px; background-color: transparent;',
                formHTML: 
                    '<div class="w2ui-page page-0">'+
                    '    <div class="w2ui-field">'+
                    '        <label>Replace in Column:</label>'+
                    '        <div>'+
                    '           <input name="column" type="list"/>'+
                    '        </div>'+
                    '    </div>'+
                    '    <div class="w2ui-field">'+
                    '        <label>Find:</label>'+
                    '        <div>'+
                    '            <input name="find" type="text"/>'+
                    '        </div>'+
                    '    </div>'+
                    '    <div class="w2ui-field">'+
                    '        <label>Replace:</label>'+
                    '        <div>'+
                    '            <input name="replace" type="text"/>'+
                    '        </div>'+
                    '    </div>'+
                    '    <div class="w2ui-field">'+
                    '        <label>Use Regex:</label>'+
                    '        <div>'+
                    '            <input name="regex" type="checkbox"/>'+
                    '        </div>'+
                    '    </div>'+
                    '    <div class="w2ui-field">'+
                    '        <label>Ignore Case:</label>'+
                    '        <div>'+
                    '            <input name="ignoreCase" type="checkbox"/>'+
                    '        </div>'+
                    '    </div>'+
                    '</div>'+
                    '<div class="w2ui-buttons">'+
                    '    <button class="w2ui-btn" name="cancel">Cancel</button>'+
                    '    <button class="w2ui-btn" name="ok">Ok</button>'+
                    '</div>',
                fields: [
                    { field: 'find', type: 'text', required: true },
                    { field: 'replace', type: 'text', required: true },
                    { field: 'regex', type: 'checkbox', required: true },
                    { field: 'ignoreCase', type: 'checkbox', required: true },
                    { field: 'column', type: 'list', required: true, options: { items: languageLcids } }
                ],
                actions: {
                    "ok": function () { 
                        this.validate(); 
                        w2popup.close();
                        FindRecords(this.record.find, this.record.replace, this.record.regex, this.record.ignoreCase, this.record.column.id);
                    },
                    "cancel": function () {
                        w2popup.close();
                    }
                }
            });
        }
        
        $().w2popup('open', {
            title   : 'Find and Replace',
            name    : 'findAndReplacePopup',
            body    : '<div id="form" style="width: 100%; height: 100%;"></div>',
            style   : 'padding: 15px 0px 0px 0px',
            width   : 500,
            height  : 300, 
            showMax : true,
            onToggle: function (event) {
                $(w2ui.findAndReplace.box).hide();
                event.onComplete = function () {
                    $(w2ui.findAndReplace.box).show();
                    w2ui.findAndReplace.resize();
                }
            },
            onOpen: function (event) {
                event.onComplete = function () {
                    // specifying an onOpen handler instead is equivalent to specifying an onBeforeOpen handler, which would make this code execute too early and hence not deliver.
                    $('#w2ui-popup #form').w2render('findAndReplace');
                }
            }
        });
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
            columns: [
                { field: 'schemaName', caption: 'Schema Name', size: '20%', sortable: true, resizable: true, frozen: true }
            ],
            onSave: function (event) {
                currentHandler.Save();
            },
            toolbar: {
                items: [
                    { type: 'menu-radio', id: 'entitySelect', icon: 'fa-star',
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
                    { type: 'menu-radio', id: 'type', icon: 'fa-star',
                        text: function (item) {
                            var text = item.selected;
                            var el   = this.get('type:' + item.selected);
                            return 'Type: ' + el.text;
                        },
                        selected: 'attributes',
                        items: [
                            { id: 'attributes', text: 'Attributes', icon: 'fa-camera' },
                            { id: 'options', text: 'Options', icon: 'fa-picture' },
                            { id: 'forms', text: 'Forms', icon: 'fa-picture' },
                            { id: 'views', text: 'Views', icon: 'fa-picture' },
                            { id: 'formMeta', text: 'Form Metadata', icon: 'fa-picture' },
                            { id: 'entityMeta', text: 'Entity Metadata', icon: 'fa-picture' }
                        ]
                    },
                    { type: 'button', id: 'load', text: 'Load', onClick: function (event) {
                        var entity = XrmTranslator.GetEntity();
                        
                        if (!entity || !XrmTranslator.GetType()) {
                            return;
                        }
                        
                        SetHandler();
                        
                        XrmTranslator.LockGrid("Loading " + entity + " attributes");
                        
                        currentHandler.Load();
                    } },
                    { type: 'button', id: 'autoTranslate', text: 'Auto Translate', onClick: function (event) {
                        TranslationHandler.ShowTranslationPrompt();
                    } },
                    { type: 'button', text: 'Expand all records', id: 'expandAll', onClick: function (event) {
                        ToggleExpandCollapse(true); 
                    } }, 
                    { type: 'button', text: 'Collapse all records', id: 'collapseAll', onClick: function (event) {
                        ToggleExpandCollapse(false); 
                    } },
                    { type: 'button', text: 'Find and Replace', id: 'findReplace', onClick: function (event) {
                        OpenFindAndReplaceDialog(); 
                    } }
                ]
            }
        }); 
        
        XrmTranslator.LockGrid("Loading entities");
    }
    
    function FillEntitySelector (entities) {
        entities = entities.sort(XrmTranslator.SchemaNameComparer);
        var entitySelect = w2ui.grid_toolbar.get("entitySelect").items;
        
        for (var i = 0; i < entities.length; i++) {
            var entity = entities[i];
            
            entitySelect.push(entity.SchemaName);
            XrmTranslator.entityMetadata[entity.SchemaName] = entity.MetadataId;
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

    function GetUserId() {
        return WebApiClient.Execute(WebApiClient.Requests.WhoAmIRequest);
    }
    
    function GetUserSettings(userId) {
        return WebApiClient.Retrieve({
            overriddenSetName: "usersettingscollection", 
            entityId: userId
        });
    }

    XrmTranslator.Initialize = function() {
        InitializeGrid(); 
        
        GetUserId()
            .then(function (response) {
                XrmTranslator.userId = response.UserId;

                return GetUserSettings(XrmTranslator.userId);
            })
            .then(function (response) {
                XrmTranslator.userSettings = response;
    
                return GetEntities();
            })
            .then(function(response) {
                return FillEntitySelector(response.value);
            })
            .then(function () {
                return TranslationHandler.GetAvailableLanguages();
            })
            .then(function(languages) {
                XrmTranslator.installedLanguages = languages;
                return TranslationHandler.FillLanguageCodes(languages.LocaleIds);
            })
            .then(function () {
                XrmTranslator.UnlockGrid();
            })
            .catch(XrmTranslator.errorHandler);
    }
} (window.XrmTranslator = window.XrmTranslator || {}));
