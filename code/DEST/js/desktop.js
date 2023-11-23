jQuery.noConflict();

(function ($, Swal10, PLUGIN_ID) {
  'use strict';
  const CONFIG = kintone.plugin.app.getConfig(PLUGIN_ID);                 //get config
  const TRANSLATE_FIELDS = JSON.parse(CONFIG.translate_fields);         //get translate fields from config
  const LANGUAGE_LIST = JSON.parse(CONFIG.language_list);               //get language list from config
  if (!CONFIG || !LANGUAGE_LIST || !TRANSLATE_FIELDS) return;         //check G_CONFIG, G_LANGUAGE_LIST, and G_TRANSLATE_FIELDS
  const ISO_DEFAULT = CONFIG.default_language || LANGUAGE_LIST[0].iso;

  kintone.events.on('app.record.detail.show', function () {
    try {
      window.BoK.eAutoTrans.showLang(ISO_DEFAULT);
    } catch (error) {
      return Swal10.fire({
        icon: "error",
        title: "",
        html: error.message || error,
      });
    }
  });

  //search target id
  function findPropertyById(obj, targetId) {
    for (const key in obj) {
      if (key === targetId) {
        return obj[key];
      } else if (typeof obj[key] === 'object') {
        const result = findPropertyById(obj[key], targetId);
        if (result !== undefined) {
          return result;
        }
      }
    }
  }
  //funtion for get object by value in object properties
  function getFieldData(data, fieldCode) {
    // Search in fieldList
    for (const key in data.table.fieldList) {
      if (data.table.fieldList[key].var === fieldCode) {
        return data.table.fieldList[key];
      }
    }
    // Search in subTable
    for (const subKey in data.subTable) {
      for (const key in data.subTable[subKey].fieldList) {
        if (data.subTable[subKey].fieldList[key].var === fieldCode) {
          return data.subTable[subKey].fieldList[key];
        }
      }
    }
    return null; // Return null if not found
  }
  //get table code by field in subtable
  function getTableCodeByField(obj, prop) {
    for (const key in obj) {
      const value = obj[key];
      if (value.type === 'SUBTABLE') {
        for (const entry of value.value) {
          let entryValue = entry.value;
          if (entryValue.hasOwnProperty(prop)) return key;
        }
      }
    }
    return false;
  }
  //edit screen
  kintone.events.on(['app.record.edit.show', 'app.record.create.show'], async function (event) {
    try {
      const record = event.record;                              //get record from event
      const srcLang = ISO_DEFAULT                             //get defult language code from G_config
      const schemaPage = cybozu.data.page.SCHEMA_DATA;          //get object element in cybozu.data.page
      const translateDirection = CONFIG.translate_direction;  //get translate direction from G_config

      //check and hide fields
      window.BoK.eAutoTrans.showLang(ISO_DEFAULT);


      for await (let item of TRANSLATE_FIELDS) {
        if (item.space_element) continue; //skip loop when have space_element 
        for (let j = 0; j < item.target_fields.length; j++) {
          let fieldEl = item.target_fields[j];
          let data = getFieldData(schemaPage, fieldEl.field); //find object element in schema by field
          if (data == null || !fieldEl.field) continue;
          let fieldSelector = `.field-${data.id}`;
          //check field iso have equal G_ISO_DEFAULT
          if (fieldEl.iso.toUpperCase() === ISO_DEFAULT.toUpperCase()) {
            //Add event hover over
            $(document).on('mouseover', fieldSelector, async function (e) {
              let timeout = setTimeout(async () => {
                e.preventDefault();
                const oldContextMenu = $('#custom-context-menu');

                //check old contextmenu and remove
                if (oldContextMenu.length) {
                  oldContextMenu.remove();
                }

                //create contextmenu
                var customContextMenu = $('<div>').attr('id', 'custom-context-menu')
                  .css({
                    position: 'absolute',
                    background: '#fff',
                    border: '1px solid #ccc',
                    boxShadow: '2px 2px 5px rgba(0, 0, 0, 0.1)',
                    padding: '5px',
                    left: e.pageX + 'px',
                    top: e.pageY + 'px'
                  });
                //create Hover option and event handler
                $.each(item.target_fields, function (i, field) {
                  if (field.iso.toUpperCase() !== ISO_DEFAULT.toUpperCase() && field.field !== '') {
                    let targetField = field.field;
                    let srcField = data.var;
                    let buttonLabel = LANGUAGE_LIST.filter(lang => lang.iso.toUpperCase() === field.iso.toUpperCase())[0].button_label;
                    const hoverBtn = new Kuc.Button({
                      text: buttonLabel,
                      type: 'normal',
                      id: targetField
                    });
                    customContextMenu.append(hoverBtn);
                    //add event handler to button
                    $(hoverBtn).on('click', async () => {
                      try {
                        const destLang = field.iso;   //filter for get lang code2 in config for use in api 
                        let fieldType = findPropertyById(record, srcField).type //get field type from record by src field
                        let subtable = getTableCodeByField(record, data.var); //get table code by fieldCode
                        let tableIndex = $(e.target).closest('tr').index(); //get row index in subtable
                        customContextMenu.remove(); //remove contextMenu
                        await setTranslate(fieldType, destLang, srcLang, subtable, srcField, targetField, tableIndex).then(() => {
                          Swal10.fire({
                            position: "center-center",
                            icon: "success",
                            text: "翻訳完了しました",
                            showConfirmButton: false,
                            timer: 1000
                          });
                        })
                      } catch (error) {
                        return Swal10.fire({
                          icon: "error",
                          title: "",
                          html: error.message || error || "項目コードが存在しません",
                        });
                      }

                    })
                  }
                });
                $('body').append(customContextMenu);
                // funtion for remove contextMenu
                $(document).on('click', function (el) {
                  if (!customContextMenu.is(el.currentTarget) && customContextMenu.has(el.currentTarget).length === 0) {
                    customContextMenu.remove();
                  }
                });
                //remove contextMenu when mouseleave from button
                customContextMenu.on('mouseleave', function () {
                  customContextMenu.remove();
                });

              }, 400);
              //check mouseout
              $(this).on('mouseout', function () {
                clearTimeout(timeout);
              });
            });
          }
        }
      }

      //only retrieve objects with spcae elements and the majority of fields
      let spaceElementsMap = {};
      let fieldButton = {};
      $.each(TRANSLATE_FIELDS, function (index, item) {
        if (item.space_element) {
          if (!spaceElementsMap[item.space_element]) {
            if (!spaceElementsMap[item.space_element]) spaceElementsMap[item.space_element] = [];
            spaceElementsMap[item.space_element].push(item); if (!fieldButton[item.space_element]) {
              fieldButton[item.space_element] = [];
              for (let i = 0; i < item.target_fields.length; i++) fieldButton[item.space_element].push(false);
            }
            for (let i = 0; i < item.target_fields.length; i++) {
              fieldButton[item.space_element][i] = item.target_fields[i].field != '';
            }
          } else {
            const existingItem = spaceElementsMap[item.space_element][0];
            for (let i = 0; i < item.target_fields.length; i++) {
              if (item.target_fields[i].field && !existingItem.target_fields[i].field) {
                fieldButton[item.space_element][i] = item.target_fields[i].field != '';
              }
            }
          }
        }
      })

      //create button translate to space element
      $.each(spaceElementsMap, function (space, item) {//comment use spaceElementMap
        let spaceElement = kintone.app.record.getSpaceElement(space);
        $.each(LANGUAGE_LIST, function (i, lang) {//comment fix loop
          let buttonLabel = LANGUAGE_LIST[i].button_label;
          if (fieldButton[space][i] === false || lang.iso.toUpperCase() === ISO_DEFAULT.toUpperCase()) return;
          const btn = new Kuc.Button({
            text: buttonLabel,
            type: 'normal'
          });
          spaceElement.append(btn);

          //add event to button
          $(btn).on('click', async function (e) {
            const filteredItems = TRANSLATE_FIELDS.filter(value => value.space_element === space);                                          //filter object that have space_element = space
            for (let i = 0; i < filteredItems.length; i++) {
              try {
                const destLang = LANGUAGE_LIST.filter(item => item.button_label === e.target.text)[0].iso;                                    //filter for get lang code2 in config for use in api
                let srcField = filteredItems[i].target_fields.filter(item => item.iso.toUpperCase() === ISO_DEFAULT.toUpperCase())[0].field;  //get src fieldcode from filteredItem
                let targetField = filteredItems[i].target_fields.filter(item => item.iso.toUpperCase() === destLang.toUpperCase())[0].field;  //get target fieldcode from filteredItem
                if (!srcField || !targetField) continue;
                let fieldType = findPropertyById(record, srcField).type;
                let subTable = getTableCodeByField(record, srcField);
                await setTranslate(fieldType, destLang, srcLang, subTable, srcField, targetField, -1).then(() => {
                  Swal10.fire({
                    position: "center-center",
                    icon: "success",
                    text: "翻訳完了しました",
                    showConfirmButton: false,
                    timer: 1000
                  });
                });
              } catch (error) {
                return Swal10.fire({
                  icon: "error",
                  title: "",
                  html: error.message || error || "項目コードが存在しません",
                });
              }
            }
          });

        });

      });

      //create a function translation 
      async function setTranslate(fieldType, destLang, srcLang, isSubTable, srcField, targetField, tableIndex) {
        let resp = kintone.app.record.get();
        let resText = '';
        if (isSubTable !== false) {                       //translate in subtable case
          let tableCode = isSubTable;                     //when isSubTable is not false then isSubTable is table code
          let tableValue = resp.record[tableCode].value;  //get table value by tableCode
          for (let i = 0; i < tableValue.length; i++) {
            // check tableIndex
            let row = tableIndex < 0 ? i : tableIndex;
            switch (translateDirection) {
              //translateDirection 'from' case
              case 'from':                                //translate from target field to srcfield
                if (srcField) {
                  resText = await window.BoK.eAutoTrans.transText(srcLang, tableValue[row].value[targetField].value || '', destLang, fieldType);
                  kintone.app.record.set(event, tableValue[row].value[srcField].value = resText);
                  tableValue[row].value[srcField].value = resText;
                  kintone.app.record.set(resp);
                }
                break;
              //translateDirection 'to' case
              case 'to':  //translate from srcfield to targetfield
                if (targetField) {
                  resText = await window.BoK.eAutoTrans.transText(destLang, tableValue[row].value[srcField].value || '', srcLang, fieldType);
                  tableValue[row].value[targetField].value = resText;
                  kintone.app.record.set(resp);
                }
                break;
              default:
            }
            if (tableIndex > -1) break;
          }
        } else {      //translate sring 1 line, string multiple lines and rich text case
          switch (translateDirection) {
            //translateDirection 'from' case
            case 'from':  //translate from target field to srcfield
              if (srcField) {
                resText = await window.BoK.eAutoTrans.transText(srcLang, resp.record[targetField].value || '', destLang, fieldType);
                resp.record[srcField].value = resText;
                kintone.app.record.set(resp);
              }
              break;
            //translateDirection 'to' case
            case 'to':  //translate from srcfield to targetfield
              if (targetField) {
                resText = await window.BoK.eAutoTrans.transText(destLang, resp.record[srcField].value || '', srcLang, fieldType);
                resp.record[targetField].value = resText;
                kintone.app.record.set(resp);
              }
              break;
            default:
          }
        }
      }
      return event;
    } catch (error) {
      return Swal10.fire({
        icon: "error",
        title: "",
        html: error.message || error,
      });

    }
  });


})(jQuery, Sweetalert2_10.noConflict(true), kintone.$PLUGIN_ID);