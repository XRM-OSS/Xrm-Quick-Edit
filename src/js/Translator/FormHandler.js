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
(function (FormHandler, undefined) {
    "use strict";

    FormHandler.selectedForms = null;
    FormHandler.formsByLanguage = null;
    FormHandler.lastId = null;

    function GetParsedForm (form) {
        var parser = new DOMParser();
        var formXml = parser.parseFromString(form.formxml, "text/xml");

        return formXml;
    }

    function NodesWithIdAndLabels (node) {
        if (node.id && node.getElementsByTagName("labels").length > 0 && node.getElementsByTagName("control").length > 0) {
            return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
    }

    function CreateTreeWalker(elementFilter, form, formXml) {
        if (!formXml) {
            formXml = GetParsedForm(form);
        }
        var treeWalker = document.createTreeWalker(formXml, NodeFilter.SHOW_ALL, elementFilter, false);

        return treeWalker;
    }

    function TraverseTree (treeWalker, tree) {
        // Dive down
        var child = CreateGridNode(treeWalker.firstChild());

        if (!child) {
            return;
        }

        // Push each first child per level
        tree.push(child);
        TraverseTree(treeWalker, child.w2ui.children);

        // We'll dive up level to level now and add all siblings
        while (treeWalker.nextSibling()) {
            var sibling = CreateGridNode(treeWalker.currentNode);
            tree.push(sibling);
            TraverseTree(treeWalker, sibling.w2ui.children);
        }

        treeWalker.parentNode();
    }

    function GetUpdates(records) {
        var updates = [];

        for (var i = 0; i < records.length; i++) {
            var record = records[i];

            if (record.w2ui && record.w2ui.changes) {
                var changes = record.w2ui.changes;

                var labels = [];

                for (var change in changes) {
                    if (!changes.hasOwnProperty(change)) {
                        continue;
                    }

                    // Skip empty labels
                    if (!changes[change]) {
                        continue;
                    }

                    var label = { LanguageCode: change, Text: changes[change] };
                    labels.push(label);
                }

                if (labels.length < 1) {
                    continue;
                }

                updates.push({
                    id: record.recid,
                    labels: labels
                });
            }
        }

        return updates;
    }

    function GetLabels(node) {
        var labelsNode = null;
        var children = node.children;

        for (var i = 0; i < children.length; i++) {
            var child = children[i];

            if (child && child.tagName === "labels") {
                labelsNode = child;
                break;
            }
        }

        return labelsNode;
    }

    function AttachLabels(node, gridNode) {
        var labels = GetLabels(node);

        if (!labels) {
            return;
        }

        for (var i = 0; i < labels.children.length; i++) {
            var label = labels.children[i];

            var text = label.attributes["description"].value;
            var languageCode = label.attributes["languagecode"].value;

            gridNode[languageCode] = text;
        }
    }

    function CreateGridNode (node) {
        if (!node) {
            return null;
        }

        var attributes = node.attributes;
        var name = "";

        if (attributes["name"]) {
            name = attributes["name"].value;
        }
        else {
            // var nodeid =  attributes["id"].value;
            name = node.tagName;
        }

        var gridNode = {
            recid: node.id,
            schemaName: name,
            w2ui: {
                children: []
            }
        };

        AttachLabels(node, gridNode);

        for (var i = 0; i < FormHandler.selectedForms.length; i++) {
            var node = GetById(node.id, FormHandler.selectedForms[i]);
            AttachLabels(node, gridNode);
        }

        return gridNode;
    }

    function FillTable () {
        var grid = XrmTranslator.GetGrid();
        grid.clear();

        var records = [];

        var treeWalker = CreateTreeWalker(NodesWithIdAndLabels, XrmTranslator.metadata);
        TraverseTree(treeWalker, records);

        XrmTranslator.AddSummary(records, true);
        grid.add(records);
        grid.unlock();
    }

    function GetUserLanguageForm (forms) {
        for (var i = 0; i < forms.length; i++) {
            if (forms[i].languageCode === XrmTranslator.userSettings.uilanguageid) {
                return forms[i];
            }
        }

        return null;
    }

    function ProcessSelection(formId) {
        var formsByLanguage = FormHandler.formsByLanguage;
        var userLanguageForms = GetUserLanguageForm(formsByLanguage).forms.value;

        for (var i = 0; i < userLanguageForms.length; i++) {
            var languageForm = userLanguageForms[i];

            if (languageForm.formid === formId) {
                XrmTranslator.metadata = languageForm;
                break;
            }
        }

        FormHandler.selectedForms = [];
        for (var i = 0; i < formsByLanguage.length; i++) {
            var languageForms = formsByLanguage[i];

            for (var j = 0; j < languageForms.forms.value.length; j++) {
                var languageForm = languageForms.forms.value[j];

                if (languageForm.formid === formId) {
                    FormHandler.selectedForms.push(languageForm);
                    break;
                }
            }
        }

        FillTable();
    }

    function ShowFormSelection () {
        var formsByLanguage = FormHandler.formsByLanguage;

        if (!w2ui.formSelectionPrompt) {
            $().w2form({
                name: 'formSelectionPrompt',
                style: 'border: 0px; background-color: transparent;',
                formHTML:
                    '<div class="w2ui-page page-0">'+
                    '    <div class="w2ui-field">'+
                    '        <label>Form:</label>'+
                    '        <div>'+
                    '           <input name="formSelection" type="list" />'+
                    '        </div>'+
                    '    </div>'+
                    '</div>'+
                    '<div class="w2ui-buttons">'+
                    '    <button class="w2ui-btn" name="cancel">Cancel</button>'+
                    '    <button class="w2ui-btn" name="ok">Ok</button>'+
                    '</div>',
                fields: [
                    { field: 'formSelection', type: 'list', required: true, html: {attr: 'style="width: 80%"'} }
                ],
                actions: {
                    "ok": function () {
                        this.validate();

                        ProcessSelection(this.record.formSelection.id);

                        w2popup.close();
                    },
                    "cancel": function () {
                        XrmTranslator.UnlockGrid();
                        w2popup.close();
                    }
                }
            });
        }

        var userLanguageForms = GetUserLanguageForm(formsByLanguage).forms.value;

        var formItems = [];

        for (var i = 0; i < userLanguageForms.length; i++) {
            var form = userLanguageForms[i];

            formItems.push({
                id: form.formid,
                text: form.name + " - " + form.description
            });
        }

        w2ui.formSelectionPrompt.record.formSelection = null;
        w2ui.formSelectionPrompt.fields[0].options = { items: formItems };

        $().w2popup('open', {
            title   : 'Choose Form',
            name    : 'formSelectionPopup',
            body    : '<div id="form" style="width: 100%; height: 100%;"></div>',
            style   : 'padding: 15px 0px 0px 0px',
            width   : 500,
            height  : 300,
            showMax : true,
            onToggle: function (event) {
                $(w2ui.formSelection.box).hide();
                event.onComplete = function () {
                    $(w2ui.formSelection.box).show();
                    w2ui.formSelection.resize();
                }
            },
            onOpen: function (event) {
                event.onComplete = function () {
                    // specifying an onOpen handler instead is equivalent to specifying an onBeforeOpen handler, which would make this code execute too early and hence not deliver.
                    $('#w2ui-popup #form').w2render('formSelectionPrompt');
                }
            }
        });
    }

    function IdFilter (node) {
        if (node.id == this.id) {
            return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
    }

    function GetById (id, form, formXml) {
        var treeWalker = CreateTreeWalker(IdFilter.bind({ id: id }), form, formXml);

        return treeWalker.nextNode();
    }

    function ApplyLabelUpdates (labels, updates, formXml) {
        for (var i = 0; i < updates.length; i++) {
            var update = updates[i];

            for (var j = 0; j < labels.children.length; j++) {
                var label = labels.children[j];

                if (update.LanguageCode === label.attributes["languagecode"].value) {
                    label.attributes["description"].value = update.Text;
                }
                // We did not find it
                else if (j === labels.children.length - 1) {
                    var newLabel = formXml.createElement("label");

                    newLabel.setAttribute("description", update.Text);
                    newLabel.setAttribute("languagecode", update.LanguageCode);

                    labels.appendChild(newLabel);
                }
            }
        }
    }

    function SerializeXml(formXml) {
        var serializer = new XMLSerializer();

        return serializer.serializeToString(formXml);
    }

    function ApplyUpdates(updates, form, formXml) {
        for (var i = 0; i < updates.length; i++) {
            var update = updates[i];

            var node = GetById(update.id, form, formXml);
            var labels = GetLabels(node);

            ApplyLabelUpdates(labels, update.labels, formXml);
        }

        var serialized = SerializeXml(formXml);

        return {
            formxml: serialized
        };
    }

    FormHandler.Load = function () {
        var entityName = XrmTranslator.GetEntity();
        var entityMetadataId = XrmTranslator.entityMetadata[entityName];

        var formRequest = {
            entityName: "systemform",
            queryParams: "?$filter=objecttypecode eq '" + entityName.toLowerCase() + "' and iscustomizable/Value eq true and formactivationstate eq 1"
        };

        if (entityName.toLowerCase() === "none") {
            formRequest.queryParams = "?$filter=formactivationstate eq 1 and iscustomizable/Value eq true and (type eq 0 or type eq 10)"
        }

        var languages = XrmTranslator.installedLanguages.LocaleIds;
        var initialLanguage = XrmTranslator.userSettings.uilanguageid;
        var forms = [];
        var requests = [];

        for (var i = 0; i < languages.length; i++) {
            requests.push({
                action: "Update",
                language: languages[i]
            });

            requests.push({
                action: "Retrieve",
                language: languages[i]
            });
        }

        requests.push({
            action: "Update",
            language: initialLanguage
        });

        return WebApiClient.Promise.reduce(requests, function(total, request){
            if (request.action === "Update") {
                return WebApiClient.Update({
                    overriddenSetName: "usersettingscollection",
                    entityId: XrmTranslator.userId,
                    entity: { uilanguageid: request.language }
                })
                .then(function(response) {
                    return total;
                });
            }
            else if (request.action === "Retrieve") {
                return WebApiClient.Promise.props({
                    forms: WebApiClient.Retrieve(formRequest),
                    languageCode: request.language
                })
                .then(function (response) {
                    total.push(response);

                    return total;
                });
            }
        }, [])
        .then(function(responses) {
            FormHandler.formsByLanguage = responses;

            if (FormHandler.lastId) {
                ProcessSelection(FormHandler.lastId);
                FormHandler.lastId = null;
            }
            else {
                ShowFormSelection();
            }
        })
        .catch(XrmTranslator.errorHandler);
    }

    FormHandler.Save = function() {
        XrmTranslator.LockGrid("Saving");

        var records = XrmTranslator.GetGrid().records;
        var formXml = GetParsedForm(XrmTranslator.metadata);
        var updates = GetUpdates(records);

        var update = ApplyUpdates(updates, XrmTranslator.metadata, formXml);

        return XrmTranslator.SetBaseLanguage(XrmTranslator.userId)
        .then(function() {
            return WebApiClient.Update({
                entityName: "systemform",
                entityId: XrmTranslator.metadata.formid,
                entity: update
            });
        })
        .then(function (response){
            XrmTranslator.LockGrid("Publishing");
            var entityName = XrmTranslator.GetEntity();
            if (entityName.toLowerCase() === "none") {
                return XrmTranslator.PublishDashboard([{ recid: XrmTranslator.metadata.formid }]);
            }
            else {
                return XrmTranslator.Publish();
            }
        })
        .then(function (response) {
            XrmTranslator.LockGrid("Reloading");

            FormHandler.lastId = XrmTranslator.metadata.formid;
            return FormHandler.Load();
        })
        .catch(XrmTranslator.errorHandler);
    }
} (window.FormHandler = window.FormHandler || {}));
