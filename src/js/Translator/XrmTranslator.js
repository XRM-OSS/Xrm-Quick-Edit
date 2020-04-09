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

    XrmTranslator.lockAcquired = null;

    // We need those for the FormHandleer, uilanguageid is current user language, formXml only contains labels for this locale by default
    XrmTranslator.userId = null;
    XrmTranslator.userSettings = null;
    XrmTranslator.installedLanguages = null;
    XrmTranslator.baseLanguage = null;

    XrmTranslator.config = null;

    XrmTranslator.columnRestoreNeeded = false;

    var currentHandler = null;

    RegExp.escape= function(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    };

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

    XrmTranslator.ComponentType = {
        Entity: 1,
        Attribute: 2,
        Relationship: 3,
        AttributePicklistValue: 4,
        AttributeLookupValue: 5,
        ViewAttribute: 6,
        LocalizedLabel: 7,
        RelationshipExtraCondition: 8,
        OptionSet: 9,
        EntityRelationship: 10,
        EntityRelationshipRole: 11,
        EntityRelationshipRelationships: 12,
        ManagedProperty: 13,
        EntityKey: 14,
        Role: 20,
        RolePrivilege: 21,
        DisplayString: 22,
        DisplayStringMap: 23,
        Form: 24,
        Organization: 25,
        SavedQuery: 26,
        Workflow: 29,
        Report: 31,
        ReportEntity: 32,
        ReportCategory: 33,
        ReportVisibility: 34,
        Attachment: 35,
        EmailTemplate: 36,
        ContractTemplate: 37,
        KBArticleTemplate: 38,
        MailMergeTemplate: 39,
        DuplicateRule: 44,
        DuplicateRuleCondition: 45,
        EntityMap: 46,
        AttributeMap: 47,
        RibbonCommand: 48,
        RibbonContextGroup: 49,
        RibbonCustomization: 50,
        RibbonRule: 52,
        RibbonTabToCommandMap: 53,
        RibbonDiff: 55,
        SavedQueryVisualization: 59,
        SystemForm: 60,
        WebResource: 61,
        SiteMap: 62,
        ConnectionRole: 63,
        FieldSecurityProfile: 70,
        FieldPermission: 71,
        PluginType: 90,
        PluginAssembly: 91,
        SDKMessageProcessingStep: 92,
        SDKMessageProcessingStepImage: 93,
        ServiceEndpoint: 95,
        RoutingRule: 150,
        RoutingRuleItem: 151,
        SLA: 152,
        SLAItem: 153,
        ConvertRule: 154,
        ConvertRuleItem: 155,
        HierarchyRule: 65,
        MobileOfflineProfile: 161,
        MobileOfflineProfileItem: 162,
        SimilarityRule: 165,
        CustomControl: 66,
        CustomControlDefaultConfig: 68,
    };

    XrmTranslator.GetEntity = function() {
        return w2ui.grid_toolbar.get("entitySelect").selected;
    }

    XrmTranslator.GetEntityId = function() {
        return XrmTranslator.entityMetadata[XrmTranslator.GetEntity()]
    }

    XrmTranslator.GetType = function() {
        return w2ui.grid_toolbar.get("type").selected;
    }

    XrmTranslator.GetComponent = function() {
        return w2ui.grid_toolbar.get("component").selected;
    }

    function SetHandler() {
        if (XrmTranslator.GetType() === "attributes") {
            currentHandler = AttributeHandler;
        }
        else if (XrmTranslator.GetType() === "options") {
            currentHandler = OptionSetHandler;
        }
        else if (["forms", "dashboards"].indexOf(XrmTranslator.GetType()) !== -1) {
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
        else if (XrmTranslator.GetType() === "charts") {
            currentHandler = ChartHandler;
        }
        else if (XrmTranslator.GetType() === "content") {
            currentHandler = ContentSnippetHandler;
        }
        else if (XrmTranslator.GetType() === "webresources") {
            currentHandler = WebResourceHandler;
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
    };

    XrmTranslator.SchemaNameComparer = function(e1, e2) {
        if (e1.SchemaName < e2.SchemaName) {
            return -1;
        }

        if (e1.SchemaName > e2.SchemaName) {
            return 1;
        }

        return 0;
    };

    XrmTranslator.EntityComparer = function(e1, e2) {
        var e1localizedLabel = e1.DisplayName.UserLocalizedLabel || {};
        var e2localizedLabel = e2.DisplayName.UserLocalizedLabel || {};

        var e1compareValue = (e1localizedLabel.Label || e1.SchemaName).toLowerCase();
        var e2compareValue = (e2localizedLabel.Label || e2.SchemaName).toLowerCase();

        if (e1compareValue < e2compareValue) {
            return -1;
        }

        if (e1compareValue > e2compareValue) {
            return 1;
        }

        return 0;
    };

    XrmTranslator.GetGrid = function() {
        return w2ui.grid;
    };

    XrmTranslator.LockGrid = function (message) {
        XrmTranslator.GetGrid().lock(message, true);
    };

    XrmTranslator.UnlockGrid = function () {
        XrmTranslator.GetGrid().unlock();
    };

    XrmTranslator.SetUserLanguage = function (userId, language) {
        return WebApiClient.Update({
            overriddenSetName: "usersettingscollection",
            entityId: userId,
            entity: {
                uilanguageid: language,
                helplanguageid: language
            }
        });
    };

    XrmTranslator.GetBaseLanguage = function() {
        if (XrmTranslator.baseLanguage) {
            return Promise.resolve(XrmTranslator.baseLanguage);
        }

        return WebApiClient.Retrieve({entityName: "organization"})
        .then(function(orgs) {
            // Org exists always
            var org = orgs.value[0];

            XrmTranslator.baseLanguage = org.languagecode;
            
            return org.languagecode;
        });
    };

    XrmTranslator.SetBaseLanguage = function (userId) {
        return XrmTranslator.GetBaseLanguage()
        .then(function(baseLanguage) {
            return XrmTranslator.SetUserLanguage(userId, baseLanguage);
        });
    };

    XrmTranslator.RestoreUserLanguage = function () {
        var initialLanguage = XrmTranslator.userSettings.uilanguageid;

        return XrmTranslator.SetUserLanguage(XrmTranslator.userId, initialLanguage);
    };

    XrmTranslator.Publish = function(globalOptionSetNames) {
        return XrmTranslator.SetBaseLanguage(XrmTranslator.userId)
            .then(function() {
                var options = (globalOptionSetNames || []);
                var optionSetString = "<optionsets>" + options.map(function(o) { return "<optionset>" + o + "</optionset>"; }).join("") + "</optionsets>";

                var xml = "<importexportxml><entities><entity>" + XrmTranslator.GetEntity().toLowerCase() + "</entity></entities>" + (options.length ? optionSetString : "") + "</importexportxml>";

                var request = WebApiClient.Requests.PublishXmlRequest
                    .with({
                        payload: {
                            ParameterXml: xml
                        }
                    })
                return WebApiClient.Execute(request);
            })
            .then(function() {
                return XrmTranslator.RestoreUserLanguage();
            })
            .catch(XrmTranslator.errorHandler);
    }

    XrmTranslator.PublishDashboard = function (dashboardIds) {
        return XrmTranslator.SetBaseLanguage(XrmTranslator.userId)
            .then(function () {

                var xml = "<importexportxml><dashboards>";
                for (var i = 0; i < dashboardIds.length; i++) {
                    xml += `<dashboard>{${dashboardIds[i].recid}}</dashboard>`;
                }
                xml += "</dashboards></importexportxml>";

                var request = WebApiClient.Requests.PublishXmlRequest
                    .with({
                        payload: {
                            ParameterXml: xml
                        }
                    })
                return WebApiClient.Execute(request);
            })
            .then(function () {
                return XrmTranslator.RestoreUserLanguage();
            })
            .catch(XrmTranslator.errorHandler);
    }

    XrmTranslator.PublishWebResources = function (webresourceIds) {
        return XrmTranslator.SetBaseLanguage(XrmTranslator.userId)
            .then(function () {

                var xml = "<importexportxml><webresources>";
                for (var i = 0; i < webresourceIds.length; i++) {
                    xml += "<webresource>" + webresourceIds[i] + "</webresource>";
                }
                xml += "</webresources></importexportxml>";

                var request = WebApiClient.Requests.PublishXmlRequest
                    .with({
                        payload: {
                            ParameterXml: xml
                        }
                    })
                return WebApiClient.Execute(request);
            })
            .then(function () {
                return XrmTranslator.RestoreUserLanguage();
            })
            .catch(XrmTranslator.errorHandler);
    }
  
    XrmTranslator.AddToSolution = function(componentIds, componentType, includeComponentSettings, includeSubComponents) {
        if (!XrmTranslator.config.solutionUniqueName) {
            return Promise.resolve(null);
        }

        XrmTranslator.LockGrid("Adding components to solution");

        return WebApiClient.Promise.resolve(componentIds)
        .each(function(c) {
            var request = WebApiClient.Requests.AddSolutionComponentRequest.with({
                payload: {
                    ComponentId: c,
                    ComponentType: componentType, // Gather this from CRM SDK in SampleCode/CS/HelperCode/OptionSets.cs, named ComponentType
                    SolutionUniqueName: XrmTranslator.config.solutionUniqueName,
                    AddRequiredComponents: false,
                    IncludedComponentSettingsValues: includeComponentSettings ? null : [],
                    DoNotIncludeSubcomponents: includeSubComponents ? false : true
                }
            });
            
            return WebApiClient.Execute(request);
        })
        .catch(XrmTranslator.errorHandler);
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

            record.w2ui.changes[result.column] = (result.w2ui &&result.w2ui.changes) ? result.w2ui.changes.replaced : result.replaced;
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
                    { field: 'column', caption: 'Column LCID', sortable: true, searchable: true, hidden: true },
                    { field: 'columnName', caption: 'Column', size: '25%', sortable: true, searchable: true },
                    { field: 'current', caption: 'Current Text', size: '25%', sortable: true, searchable: true },
                    { field: 'replaced', caption: 'Replaced Text', size: '25%', sortable: true, searchable: true, editable: { type: 'text' } }
                ],
                records: []
            };

            $(function () {
                // initialization in memory
                $().w2grid(grid);
            });
        }

        w2ui.findAndReplaceGrid.clear();
        w2ui.findAndReplaceGrid.add(results);

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

    function FindRecords(find, replace, useRegex, ignoreCase, column, columnName) {
        var records = XrmTranslator.GetAllRecords();
        var findings = [];

        var regex = null;

        if (useRegex) {
            if (ignoreCase) {
                regex = new RegExp(find, "i");
            } else {
                regex = new RegExp(find);
            }
        } else {
            if (ignoreCase) {
                regex = new RegExp(RegExp.escape(find), "i");
            } else {
                regex = new RegExp(RegExp.escape(find));
            }
        }

        for (var i = 0; i < records.length; i++) {
            var record = records[i];
            var value = record[column];

            if (record.w2ui && record.w2ui.changes && record.w2ui.changes[column]) {
                value = record.w2ui.changes[column];
            }

            if (value === null || typeof(value) === "undefined") {
                continue;
            }

            var replaced = null;

            replaced = value.replace(regex, replace);

            // No hit for search and replace
            if (value === replaced) {
                continue;
            }

            findings.push({
                recid: record.recid,
                schemaName: record.schemaName,
                column: column,
                columnName: columnName,
                current: value,
                replaced: replaced
            });
        }

        ShowFindAndReplaceResults(findings);
    }

    function InitializeFindAndReplaceDialog() {
        var languageItems = [];
        var availableLanguages = XrmTranslator.GetGrid().columns;

        for (var i = 0; i < availableLanguages.length; i++) {
            if (availableLanguages[i].field === "schemaName") {
                continue;
            }

            languageItems.push({ id: availableLanguages[i].field, text: availableLanguages[i].caption });
        }
        
        if (!w2ui.findAndReplace) {
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
                    { field: 'column', type: 'list', required: true, options: { items: languageItems } }
                ],
                actions: {
                    "ok": function () {
                        this.validate();
                        w2popup.close();
                        FindRecords(this.record.find, this.record.replace, this.record.regex, this.record.ignoreCase, this.record.column.id, this.record.column.text);
                    },
                    "cancel": function () {
                        w2popup.close();
                    }
                }
            });
        }
        else {
            // Columns will be different when user switches to portal content snippet or back from it, we need to make sure columns always match current grid columns
            w2ui.findAndReplace.fields[4].options.items = languageItems;
            
            w2ui.findAndReplace.refresh();
        }

        return Promise.resolve({});
    }

    function OpenFindAndReplaceDialog () {
        InitializeFindAndReplaceDialog()
        .then(function() {
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
        });
    }

    function IsLockedForUser(entity) {
        return WebApiClient.Retrieve({
            entityName: "oss_translationlock",
            queryParams: "?$select=_ownerid_value&$filter=oss_name eq '" + entity + "'",
            headers: [
                { key: "Prefer", value: 'odata.include-annotations="*"' }
            ]
        })
        .then(function (response){
            if (response.value.length) {
                return (response.value[0]._ownerid_value.toLowerCase() === Xrm.Page.context.getUserId().replace("{", "").replace("}", "").toLowerCase());
            }
            return false;
        });
    }

    function DisableColumns() {
        XrmTranslator.GetGrid().toolbar.set("lockOrUnlock", { img: XrmTranslator.lockAcquired ? 'w2ui-icon-pencil' : 'w2ui-icon-cross' });
        XrmTranslator.GetGrid().columns.forEach(c => {
            if (c["editable"]) {
                c["editableBackup"] = c["editable"]; delete c["editable"];
            } 
        });
        XrmTranslator.GetGrid().refresh();
    }

    function EnableColumns() {
        XrmTranslator.GetGrid().toolbar.set("lockOrUnlock", { img: XrmTranslator.lockAcquired ? 'w2ui-icon-pencil' : 'w2ui-icon-cross' });
        XrmTranslator.GetGrid().columns.forEach(c => { 
            if (c["editableBackup"]) { 
                c["editable"] = c["editableBackup"]; delete c["editableBackup"]; 
            }
        });
        XrmTranslator.GetGrid().refresh();
    }

    function AcquireLock() {
        XrmTranslator.LockGrid("Acquiring lock for entity " + XrmTranslator.GetEntity().toLowerCase());

        const entity = XrmTranslator.GetEntity().toLowerCase();

        if (!entity) {
            return Promise.resolve(null);
        }

        return WebApiClient.Create({ 
            entityName: "oss_translationlock",
            entity: {
                oss_name: entity,
                oss_language: "any"
            }
        })
        .then(function() {
            XrmTranslator.lockAcquired = true;
            EnableColumns();
            XrmTranslator.UnlockGrid();
        })
        .catch(function(e) {
            XrmTranslator.UnlockGrid();

            return WebApiClient.Retrieve({
                entityName: "oss_translationlock",
                queryParams: "?$select=_ownerid_value&$filter=oss_name eq '" + entity + "'",
                headers: [
                    { key: "Prefer", value: 'odata.include-annotations="*"' }
                ]
            })
            .then(function (response){
                if (response.value.length) {
                    if (response.value[0]._ownerid_value.toLowerCase() === Xrm.Page.context.getUserId().replace("{", "").replace("}", "").toLowerCase()) {
                        XrmTranslator.lockAcquired = true;
                        EnableColumns();
                        return null;
                    }
                    else {
                        alert("Failed to acquire lock, it is currently locked by " +  response.value[0]["_ownerid_value@OData.Community.Display.V1.FormattedValue"] + ". Opening in readonly mode.");
                    }
                }
                else {
                    alert("Failed to acquire lock, error: " + (e.message || e));
                }

                DisableColumns();
                return null;
            });
        });
    }

    function ReleaseLock(entity) {
        if (!entity) {
            return Promise.resolve(null);
        }

        const userId = Xrm.Page.context.getUserId().replace("{", "").replace("}", "");

        return WebApiClient.Retrieve({
            entityName: "oss_translationlock",
            queryParams: "?$select=oss_translationlockid&$filter=oss_name eq '" + entity + "' and _ownerid_value eq " + userId,
        })
        .then(function(response) {
            const lock = response.value.length ? response.value[0] : null;

            if (!lock) {
                return null;
            }

            return WebApiClient.Delete({
                entityName: "oss_translationlock",
                entityId: lock.oss_translationlockid
            });
        })
        .then(function(){
            XrmTranslator.lockAcquired = false;
            XrmTranslator.GetGrid().refresh();
        })
        .then(DisableColumns);
    }

    XrmTranslator.ReleaseLockAndPrompt = function(entity) {
        if (!XrmTranslator.config.enableLocking || !XrmTranslator.config.autoRelease) {
            return Promise.resolve(null);
        }

        return ReleaseLock(entity || XrmTranslator.GetEntity())
        .then(function() {
            return new Promise(function(resolve, reject) {
                w2confirm("Saving is done and your lock was released.\nDo you want to reacquire your lock to continue editing?", function (answer) {
                    resolve(answer === "Yes");
                });
            });
        })
        .then(function(reacquireLock) {
            if (reacquireLock) {
                return AcquireLock();
            }

            return null;
        });
    };

    function LoadHandler () {
        var entity = XrmTranslator.GetEntity();

        if (!entity || !XrmTranslator.GetType()) {
            return;
        }

        if (XrmTranslator.lockAcquired && entity === XrmTranslator.entity) {
            LockAndLoad(entity, true);
        }
        else {
            LockAndLoad(entity);
        }
    }

    function LockAndLoad (entity, lock) {
        if (XrmTranslator.config.enableLocking && entity) {
            IsLockedForUser(entity)
            .then(function(alreadyLockedByUser) {
                if(alreadyLockedByUser || lock || confirm("Do you want to lock this entity for translating? If you do not, it will be readonly.")) {
                    AcquireLock()
                    .then(function() {
                        TriggerLoading(entity);
                    });
                }
                else {
                    XrmTranslator.lockAcquired = false;
                    // Refresh when moving from locked to unlocked entity and not choosing to lock
                    w2ui.grid_toolbar.refresh();
                    DisableColumns();
                    TriggerLoading(entity);
                }
            });
        }
        else {
            TriggerLoading(entity);
        }
    }
    
    function TriggerLoading(entity) {
        let promise = undefined;

        if (XrmTranslator.columnRestoreNeeded) {
            XrmTranslator.ClearColumns();
            promise = TranslationHandler.FillLanguageCodes(XrmTranslator.installedLanguages.LocaleIds, XrmTranslator.userSettings, XrmTranslator.config);
        }
        else {
            promise = Promise.resolve(null);
        }

        promise.then(function(){
            XrmTranslator.columnRestoreNeeded = false;
            XrmTranslator.entity = entity;
            SetHandler();

            XrmTranslator.LockGrid("Loading " + entity + " attributes");

            // Reset column sorting
            XrmTranslator.GetGrid().sort();
            currentHandler.Load();
        });
    }

    function InitializeGrid (entities) {
        var items = [
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
                selected: "none",
                items: [
                    { id: 'none', text: 'None' },
                    { text: '--' }
                ]
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
                    { id: 'options', text: 'Options', icon: 'fa-picture' },
                    { id: 'forms', text: 'Forms', icon: 'fa-picture' },
                    { id: 'views', text: 'Views', icon: 'fa-picture' },
                    { id: 'formMeta', text: 'Form Metadata', icon: 'fa-picture' },
                    { id: 'entityMeta', text: 'Entity Metadata', icon: 'fa-picture' },
                    { id: 'charts', text: 'Charts', icon: 'fa-picture' },
                    { id: 'content', text: 'Content', icon: 'fa-picture' },
                    { id: 'dashboards', text: 'Dashboards', icon: 'fa-picture' },
                    { id: 'webresources', text: 'Web Resources', icon: 'fa-picture' }
                ]
            },
            { type: 'menu-radio', id: 'component', img: 'icon-folder',
                text: function (item) {
                    var text = item.selected;
                    var el   = this.get('component:' + item.selected);
                    return 'Component: ' + el.text;
                },
                selected: 'DisplayName',
                items: [
                    { id: 'DisplayName', text: 'DisplayName', icon: 'fa-picture' },
                    { id: 'Description', text: 'Description', icon: 'fa-picture' }
                ]
            },
            { type: 'button', id: 'load', text: 'Load', img:'w2ui-icon-reload', onClick: LoadHandler }
        ];

        if (!XrmTranslator.config.hideAutoTranslate) {
            items.push({ type: 'button', id: 'autoTranslate', text: 'Auto Translate', img:'icon-page', onClick: function (event) {
                TranslationHandler.ShowTranslationPrompt();
            } });
        }

        if (XrmTranslator.config.enableLocking) {
            items.push({ type: 'menu-radio', id: 'lockOrUnlock', img: 'w2ui-icon-cross',
                text: function (name, item) {
                    return XrmTranslator.lockAcquired ? "Locked" : "Not Locked";
                },
                items: [
                    { type: 'button', id: 'lock', text: 'Lock Entity', img:'w2ui-icon-pencil' },
                    { type: 'button', id: 'unlock', text: 'Unlock Entity', img:'w2ui-icon-cross' }
                ]
            });
        }

        items.push({ type: 'menu', id: 'toggle', img: 'icon-folder',
            text: "Toggle",
            items: [
                { type: 'button', text: 'Expand all records', id: 'expandAll' },
                { type: 'button', text: 'Collapse all records', id: 'collapseAll' }
            ]
        });

        if (!XrmTranslator.config.hideFindAndReplace) {
            items.push({ type: 'button', text: 'Find and Replace', img:'icon-page', id: 'findReplace', onClick: function (event) {
                OpenFindAndReplaceDialog();
            } });
        }

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
                items: items,
                onClick: function (event) {
                    var target = event.target;

                    if (target.startsWith("entitySelect:")) {
                        if (target === "entitySelect:none") { //None click
                            w2ui['grid_toolbar'].disable('type:attributes');
                            w2ui['grid_toolbar'].disable('type:options');
                            w2ui['grid_toolbar'].disable('type:views');
                            w2ui['grid_toolbar'].disable('type:entityMeta');
                            w2ui['grid_toolbar'].disable('type:charts');
                            w2ui['grid_toolbar'].disable('type:content');
                            w2ui['grid_toolbar'].disable('type:forms');
                            w2ui['grid_toolbar'].disable('type:formMeta');

                            w2ui['grid_toolbar'].enable('type:webresources');
                            w2ui['grid_toolbar'].enable('type:dashboards');
                        }
                        else {
                            w2ui['grid_toolbar'].enable('type:attributes');
                            w2ui['grid_toolbar'].enable('type:options');
                            w2ui['grid_toolbar'].enable('type:views');
                            w2ui['grid_toolbar'].enable('type:entityMeta');
                            w2ui['grid_toolbar'].enable('type:charts');
                            w2ui['grid_toolbar'].enable('type:forms');
                            w2ui['grid_toolbar'].enable('type:formMeta');

                            w2ui['grid_toolbar'].disable('type:webresources');
                            w2ui['grid_toolbar'].disable('type:dashboards');
                            w2ui['grid_toolbar'].disable('type:content');

                            if (target === "entitySelect:Adx_contentsnippet") {
                                w2ui['grid_toolbar'].enable('type:content');
                            }
                            
                            // Switch back to attributes if one of the now disabled options was set
                            if (["content", "webresources", "dashboards"].indexOf(w2ui.grid_toolbar.get("type").selected) !== -1) {
                                w2ui.grid_toolbar.get("type").selected = "attributes";
                                w2ui.grid_toolbar.refresh();
                            }
                        }
                    }

                    if (target.indexOf("expandAll") !== -1) {
                        ToggleExpandCollapse(true);
                    } else if (target.indexOf("collapseAll") !== -1) {
                        ToggleExpandCollapse(false);
                    }

                    switch(event.target) {
                        case "lockOrUnlock:lock":
                            LockAndLoad(XrmTranslator.GetEntity(), true);
                            break;
                        case "lockOrUnlock:unlock":
                            ReleaseLock(XrmTranslator.GetEntity())
                            break;
                    }
                }
            }
        });

        XrmTranslator.LockGrid("Loading entities");
    }

    function FillEntitySelector (entities) {
        if (XrmTranslator.config.entityWhitelist && XrmTranslator.config.entityWhitelist.length) {
            entities = entities.filter(function (e) { return XrmTranslator.config.entityWhitelist.indexOf(e.LogicalName) !== -1 });
        }

        entities = entities.sort(XrmTranslator.EntityComparer);
        var entitySelect = w2ui.grid_toolbar.get("entitySelect").items;

        for (var i = 0; i < entities.length; i++) {
            var entity = entities[i];

            var localizedLabel = entity.DisplayName.UserLocalizedLabel || {};
            entitySelect.push({id: entity.SchemaName, text: localizedLabel.Label ? `${localizedLabel.Label} (${entity.LogicalName})` : entity.LogicalName });
            XrmTranslator.entityMetadata[entity.SchemaName] = entity.MetadataId;
        }

        return entities;
    }

    function GetEntities() {
        var queryParams = "?$select=SchemaName,LogicalName,MetadataId,DisplayName&$filter=IsCustomizable/Value eq true";
        
        var request = {
            entityName: "EntityDefinition",
            queryParams: queryParams
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

    function RegisterReloadPrevention () {
        // Dashboards are automatically refreshed on browser window resize, we don't want to lose changes.
        window.onbeforeunload = function(e) {
            var records = XrmTranslator.GetGrid().records;
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

    XrmTranslator.GetAllRecords = function() {
        var records = XrmTranslator.GetGrid().records;

        var getRecords = function(recs) {
            return recs.reduce(function(all, cur) { return all.concat([cur, ...getRecords((cur.w2ui && cur.w2ui.children) ? cur.w2ui.children : [])])}, [])
        };

        return Array.from(new Set(getRecords(records)));
    };

    XrmTranslator.GetColumns = function (includeSchemaName) {
        var columns = XrmTranslator.GetGrid().columns.map(function(c) { return c.field; });

        if (includeSchemaName) {
            return columns;
        }

        return columns.filter(function(c) { return c !== "schemaName" });
    }

    XrmTranslator.ClearColumns = function() {
        var columns = XrmTranslator.GetColumns();

        columns.forEach(function(l) { XrmTranslator.GetGrid().removeColumn(l) });
    }

    XrmTranslator.AddSummary = function(records, countChildParents) {
        var parentCount = records.length;
        var childCount = records.map(function(r) { return r.w2ui && r.w2ui.children && r.w2ui.children.length; }).reduce(function(a, b) { return a + (b || 0); }, 0);

        var count = 0;

        if (childCount > 0) {
            count = childCount;

            if (countChildParents) {
                count += parentCount;
            }
        }
        else {
            count = parentCount;
        }

        var summary = {
            w2ui: { summary: true },
            recid: 'Summary-1',
            schemaName: '<span style="float: right;">Of ' + count + ' labels in total</span>'
        };

        for (var i = 0; i < XrmTranslator.installedLanguages.LocaleIds.length; i++) {
            var language = XrmTranslator.installedLanguages.LocaleIds[i].toString();

            var translatedParents = records.filter(function(r) { return !!r[language]; }).length;
            var translatedChildren = records.map(function(r) { return r.w2ui && r.w2ui.children && r.w2ui.children.filter(function(c) { return !!c[language]; })}).reduce(function(a, b) { return a + (b || []).length; }, 0);

            var translatedRecords = 0;

            if (translatedChildren > 0) {
                translatedRecords = translatedChildren;

                if (countChildParents) {
                    translatedRecords += translatedParents;
                }
            }
            else {
                translatedRecords = translatedParents;
            }

            summary[language] = translatedRecords + " translated (" + (count - translatedRecords) + " untranslated)";
        }

        records.push(summary);
    };

    function FetchConfig() {
        return WebApiClient.Retrieve({ overriddenSetName: "webresourceset", entityId: "8AF4EAED-7454-E911-80FA-0050568E4745"})
        .then(function (result) {           
                var config = JSON.parse(atob(result.content));
                
                XrmTranslator.config = config;
        });
    }

    XrmTranslator.Initialize = function() {
        FetchConfig()
        .then(function() {
            return XrmTranslator.GetBaseLanguage();
        })
        .then(function() {
            InitializeGrid();
            RegisterReloadPrevention();

            return GetUserId();
        })
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
            return TranslationHandler.FillLanguageCodes(languages.LocaleIds, XrmTranslator.userSettings, XrmTranslator.config);
        })
        .then(function () {
            XrmTranslator.UnlockGrid();
        })
        .catch(XrmTranslator.errorHandler);
    }
} (window.XrmTranslator = window.XrmTranslator || {}));
