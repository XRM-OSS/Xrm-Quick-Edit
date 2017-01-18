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
(function (OptionSetHandler, undefined) {
    "use strict";
    
    function FillTable () {
        var grid = XrmTranslator.GetGrid();
        grid.clear();
        
        var records = [];
        
        for (var i = 0; i < XrmTranslator.metadata.length; i++) {
            var attribute = XrmTranslator.metadata[i];

            var optionSet = attribute.OptionSet;
            var options = optionSet.Options;
            
            if (!options || options.length === 0) {
                continue;
            }
            
            var record = {
                recid: attribute.MetadataId,
                schemaName: attribute.LogicalName,
                w2ui: {
                    children: []
                }
            };
            
            for (var j = 0; j < options.length; j++) {
                var option = options[j];
                var labels = option.Label.LocalizedLabels;

                var child = {
                    recid: record.recid + "-" + option.Value,
                    schemaName: option.Value
                };

                for (var k = 0; k < labels.length; k++) {
                    var label = labels[k];
                    child[label.LanguageCode.toString()] = label.Label;
                }
                
                record.w2ui.children.push(child);
            }
            
            records.push(record);
        }
        
        grid.add(records);
        grid.unlock();
    }
    
    OptionSetHandler.Load = function () {
        var entityName = XrmTranslator.GetEntity();
        var entityMetadataId = XrmTranslator.entityMetadata[entityName];
        
        var request = {
            entityName: "EntityDefinition", 
            entityId: entityMetadataId, 
            queryParams: "/Attributes/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$expand=OptionSet,GlobalOptionSet"
        };
        
        WebApiClient.Retrieve(request)
            .then(function(response){
                var attributes = response.value.sort(XrmTranslator.SchemaNameComparer);
                XrmTranslator.metadata = attributes;
                
                FillTable();
            })
            .catch(XrmTranslator.errorHandler);
    }
    
    OptionSetHandler.Save = function() {
        XrmTranslator.LockGrid("Saving");
        
        var updates = XrmTranslator.GetUpdates();
        
        var requests = [];
        var entityUrl = WebApiClient.GetApiUrl() + "EntityDefinitions(" + entityMetadata[currentEntity] + ")/Attributes(";
        
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
        
        Promise.resolve(requests)
            .each(function(request) {
                return WebApiClient.SendRequest(request.method, request.url, request.attribute, request.headers);
            })
            .then(function (response){
                XrmTranslator.LockGrid("Publishing");
                
                return XrmTranslator.Publish();
            })
            .then(function (response) {
                XrmTranslator.LockGrid("Reloading");
                
                return LoadEntityAttributes(currentEntity);
            })
            .catch(XrmTranslator.errorHandler);
    }
} (window.OptionSetHandler = window.OptionSetHandler || {}));