(function ($, Swal10, PLUGIN_ID) {
  "use strict";

  const CONF = kintone.plugin.app.getConfig(PLUGIN_ID);
  const SUPPORTED_LANGUAGES = window.language_pack();
  const TRANSLATE_ENGINE = JSON.parse(CONF.translate_engine) || {};
  const TRANSLATE_ENGINE_TYPE = TRANSLATE_ENGINE.type;
  const TRANSLATE_ENGINE_URL = TRANSLATE_ENGINE.url;
  const TRANSLATE_FIELDS = JSON.parse(CONF.translate_fields);

  if (window.BoK === undefined) window.BoK = {};
  var BoK = window.BoK.eAutoTrans = {
    transText: async function (destLang, srcText, srcLang, srcType) {
      try {
        let texts = srcText;
        let translatedText = '';
        destLang = TRANSLATE_ENGINE_TYPE === 'google_tran_api' ? SUPPORTED_LANGUAGES.google_tran_api.filter(item => item.iso.toUpperCase() === destLang.toUpperCase())[0].code
          : TRANSLATE_ENGINE_TYPE === 'my_memory_api' ? SUPPORTED_LANGUAGES.my_memory_api.filter(item => item.iso.toUpperCase() === destLang.toUpperCase())[0].code
            : TRANSLATE_ENGINE_TYPE === 'deepl_api' ? SUPPORTED_LANGUAGES.deepl_api.filter(item => item.iso.toUpperCase() === destLang.toUpperCase())[0].code
              : ''
        srcLang = TRANSLATE_ENGINE_TYPE === 'google_tran_api' ? SUPPORTED_LANGUAGES.google_tran_api.filter(item => item.iso.toUpperCase() === srcLang.toUpperCase())[0].code
          : TRANSLATE_ENGINE_TYPE === 'my_memory_api' ? SUPPORTED_LANGUAGES.my_memory_api.filter(item => item.iso.toUpperCase() === srcLang.toUpperCase())[0].code
            : TRANSLATE_ENGINE_TYPE === 'deepl_api' ? SUPPORTED_LANGUAGES.deepl_api.filter(item => item.iso.toUpperCase() === srcLang.toUpperCase())[0].code
              : ''
        if (!texts) return '';
        if (!destLang || !srcLang) return;
        if (TRANSLATE_ENGINE_TYPE) {
          switch (srcType) {
            case 'SINGLE_LINE_TEXT':
              if (TRANSLATE_ENGINE_TYPE === 'google_tran_api') {
                translatedText = await translateFunction.googleTrans(srcText, srcLang, destLang);
              }
              else if (TRANSLATE_ENGINE_TYPE === 'my_memory_api') {
                translatedText = await translateFunction.myMemoryTrans(srcText, srcLang, destLang);
              }
              else if (TRANSLATE_ENGINE_TYPE === 'deepl_api') {
                translatedText = await translateFunction.myDeepLTrans(srcText, srcLang, destLang);
              }
              return translatedText;
            case 'MULTI_LINE_TEXT':
              texts = texts.split('\n')
              for await (let item of texts) {
                if (!item) continue;
                if (TRANSLATE_ENGINE_TYPE === 'google_tran_api') {
                  let transText = await translateFunction.googleTrans(item, srcLang, destLang);
                  if(typeof transText === 'object'){
                    return transText;
                  }
                  translatedText += `${transText}\n`;
                }
                else if (TRANSLATE_ENGINE_TYPE === 'my_memory_api') {
                  let transText = await translateFunction.myMemoryTrans(item, srcLang, destLang);
                  if(typeof transText === 'object'){
                    return transText;
                  }
                  translatedText += `${transText}\n`;
                }
                else if (TRANSLATE_ENGINE_TYPE === 'deepl_api') {
                  let transText =  await translateFunction.myDeepLTrans(item, srcLang, destLang);
                  if(typeof transText === 'object'){
                    return transText;
                  }
                  translatedText += `${transText}\n`;
                }
              }
              return translatedText;
            case 'RICH_TEXT':
              const parser = new DOMParser();
              const doc = parser.parseFromString(texts, 'text/html');
              const txtArr = [];

              const setOnlyTextInHtmlToArray = (node) => {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') {
                  txtArr.push(node.textContent.trim());
                } else {
                  for (const childNode of node.childNodes) {
                    setOnlyTextInHtmlToArray(childNode);
                  }
                }
              };

              setOnlyTextInHtmlToArray(doc.body);

              //translate text and replace it to old values
              for await (const item of txtArr) {
                if (item == '' || /^\s+$/.test(item)) {
                  texts = texts.replace(`${item}`, `${item}`);
                } else {
                  if (TRANSLATE_ENGINE_TYPE === 'google_tran_api') {
                    texts = texts.replace(`${item}`, await translateFunction.googleTrans(item, srcLang, destLang));
                  }
                  else if (TRANSLATE_ENGINE_TYPE === 'my_memory_api') {
                    texts = texts.replace(`${item}`, await translateFunction.myMemoryTrans(item, srcLang, destLang));
                  }
                  else if (TRANSLATE_ENGINE_TYPE === 'deepl_api') {
                    texts = texts.replace(`${item}`, await translateFunction.myDeepLTrans(item, srcLang, destLang));
                  }
                }
              }
              return texts;
            default:
          }
        } else {
          return;
        }
      } catch (error) {
        console.error('Error:', error.message);
      }

    },

    showLang: function (showLang) {
      $.each(TRANSLATE_FIELDS, function (i, item) {
        $.each(item.target_fields, function (j, fieldEl) {
          if (window.BoK.eForm === undefined) {
            kintone.app.record.setFieldShown(fieldEl.field, fieldEl.iso.toUpperCase() === showLang.toUpperCase());
          } else {
            window.BoK.eForm.setFieldShow(fieldEl.field, fieldEl.iso.toUpperCase() === showLang.toUpperCase());
          }
        });
      });
    },

    trans: async function (destLang, srcLang, defCode, rows) {
      function getTableCodeByField(obj, prop) {
        for (const key in obj) {
          const value = obj[key];
          if (value.type === 'SUBTABLE') {
            for (const entry of value.value) {
              let entryValue = entry.value;
              if (entryValue[prop]) return key;
            }
          }
        }
        return false;
      }
      var record = kintone.app.record.get();
      if (!destLang || !srcLang) return;
      if (Array.isArray(defCode)) {
        for (const itemCode of defCode) {
          let translateItem = TRANSLATE_FIELDS.filter(item => item.item_code === itemCode)[0].target_fields;
          let destField = translateItem.filter(item => item.iso === destLang)[0].field;
          let srcField = translateItem.filter(item => item.iso === srcLang)[0].field;
          let subTable = getTableCodeByField(record.record, destField)
          let subTableData = record.record[subTable].value;
          if (!Array.isArray(rows)) {
            let startIndex = rows === -1 ? 0 : rows;
            for (let i = startIndex; i < subTableData.length; i++) {
              let srcFieldText = subTableData[i].value[srcField].value;
              let srcFieldType = subTableData[i].value[srcField].type;
              let resTxt = await this.transText(destLang, srcFieldText, srcLang, srcFieldType);
              record.record[subTable].value[i].value[destField].value = resTxt;
            }
          } else {
            for (let i = 0; i < rows.length; i++) {
              let srcFieldText = subTableData[rows[i]].value[srcField].value;
              let srcFieldType = subTableData[rows[i]].value[srcField].type;
              let resTxt = await this.transText(destLang, srcFieldText, srcLang, srcFieldType);
              record.record[subTable].value[rows[i]].value[destField].value = resTxt;
            }
          }
        }
      } else {
        let translateItem = TRANSLATE_FIELDS.filter(item => item.item_code === defCode)[0].target_fields;
        let destField = translateItem.filter(item => item.iso === destLang)[0].field;
        let srcField = translateItem.filter(item => item.iso === srcLang)[0].field;
        let subTable = getTableCodeByField(record.record, destField)
        let subTableData = record.record[subTable].value;
        if (!Array.isArray(rows)) {
          let startIndex = rows === -1 ? 0 : rows;
          for (let i = startIndex; i < subTableData.length; i++) {
            let srcFieldText = subTableData[i].value[srcField].value;
            let srcFieldType = subTableData[i].value[srcField].type;
            let resTxt = await this.transText(destLang, srcFieldText, srcLang, srcFieldType);
            record.record[subTable].value[i].value[destField].value = resTxt;
          }
        } else {
          for (let i = 0; i < rows.length; i++) {
            let srcFieldText = subTableData[rows[i]].value[srcField].value;
            let srcFieldType = subTableData[rows[i]].value[srcField].type;
            let resTxt = await this.transText(destLang, srcFieldText, srcLang, srcFieldType);
            record.record[subTable].value[rows[i]].value[destField].value = resTxt;
          }
        }
      }
      try {
        kintone.app.record.set(record);
      } catch (error) {
        throw new Error(`フィールドコード${defCode}が存在しません`);
      }
    }
  }

  let translateFunction = {
    googleTrans: async function (srcText, srcLang, destLang) {
      try {
        let url = TRANSLATE_ENGINE_URL;
        if (!url) return alert('Translate engine url not setting in config');
        let trans = await axios({ method: 'GET', url: `${url}/single?client=gtx&sl=${srcLang}&tl=${destLang}&dt=t&q=${srcText}` }).catch((err) => {
          throw new Error(err.message || err);
        })

        if (trans.status === 200) {
          let txt = '';
          trans.data[0].forEach((item) => {
            txt += item[0];
          });
          // Calculate the leading and trailing spaces to restore
          var leadingSpaces = srcText.match(/^\s*/)[0];
          var trailingSpaces = srcText.match(/\s*$/)[0];

          // Return the translated text with the preserved spaces
          return leadingSpaces + txt + trailingSpaces;
        } else {
          throw new Error('Translation request failed with status: ' + trans.status);
        }
      } catch (error) {
        console.error('Error:', error.message);
        return {
          status: 'error',
          msg: error.message
        }
      }
    },

    myMemoryTrans: async function (srcText, srcLang, destLang) {
      try {
        let url = TRANSLATE_ENGINE_URL;
        if (!url) return alert('Translate engine url not setting in config');
        let trans = await axios({ method: 'GET', url: `${url}/get?q=${srcText}&langpair=${srcLang}|${destLang}` }).catch((err) => {
          throw new Error(err.message || err);
        })

        if (trans.status === 200) {
          let txt = trans.data.responseData.translatedText;
          // Calculate the leading and trailing spaces to restore
          var leadingSpaces = srcText.match(/^\s*/)[0];
          var trailingSpaces = srcText.match(/\s*$/)[0];

          // Return the translated text with the preserved spaces
          return leadingSpaces + txt + trailingSpaces;
          // return txt;
        } else {
          throw new Error(
            'Translation request failed with status: ' +
            response.status +
            'MyMemory API status: ' +
            response.data.responseStatus
          );
        }
      } catch (error) {
        console.error('Error:', error.message);
        return {
          status: 'error',
          msg: error.message
        }
      }
    },

    myDeepLTrans: async function (destLang, srcText, srcLang) {
      try {
        let url = TRANSLATE_ENGINE_URL;
        let apiKey = '';
        if (!url) return alert('Translate engine url not setting in config');
        let trans = await axios({ method: 'POST', url: `${url}/get?q=${srcText}&langpair=${srcLang}|${destLang}`, headers: { 'Authorization': `DeepL-Auth-Key ${apiKey}` } }).catch((err) => {
          throw new Error(err.message || err);
        })

        if (trans.status === 200) {
          let txt = trans.data.responseData.translations[0].text;
          // Calculate the leading and trailing spaces to restore
          var leadingSpaces = srcText.match(/^\s*/)[0];
          var trailingSpaces = srcText.match(/\s*$/)[0];
          // Return the translated text with the preserved spaces
          return leadingSpaces + txt + trailingSpaces;
          // return txt;
        } else {
          throw new Error(
            'Translation request failed with status: ' +
            response.status +
            'DeepL API status: ' +
            response.data.responseStatus
          );
        }
      } catch (error) {
        console.error('Error:', error.message);
        return {
          status: 'error',
          msg: error.message
        }
      }
    }
  }
  window.BoK.eAutoTrans = BoK;
})(jQuery, Sweetalert2_10.noConflict(true), kintone.$PLUGIN_ID);