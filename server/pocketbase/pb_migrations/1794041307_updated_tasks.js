/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2602490748")

  // add field
  collection.fields.addAt(25, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text1410257210",
    "max": 40,
    "min": 0,
    "name": "completed_at",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2602490748")

  // remove field
  collection.fields.removeById("text1410257210")

  return app.save(collection)
})
