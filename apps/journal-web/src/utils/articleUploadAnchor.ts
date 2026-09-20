import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const articleUploadKey = new PluginKey<DecorationSet>('articleUpload');
export const ArticleUploadAnchor = Extension.create({
  name: 'articleUploadAnchor',
  addProseMirrorPlugins() {
    return [new Plugin({
      key: articleUploadKey,
      state: {
        init: () => DecorationSet.empty,
        apply(transaction, previous) {
          let next = previous.map(transaction.mapping, transaction.doc);
          const action = transaction.getMeta(articleUploadKey) as { add?: { id: object; position: number }; remove?: object } | undefined;
          if (action?.add) {
            const marker = document.createElement('span');
            marker.textContent = '图片上传中…';
            marker.className = 'image-upload-anchor';
            next = next.add(transaction.doc, [Decoration.widget(action.add.position, marker, { id: action.add.id, side: 1 })]);
          }
          if (action?.remove) next = next.remove(next.find(undefined, undefined, spec => spec.id === action.remove));
          return next;
        },
      },
      props: { decorations: state => articleUploadKey.getState(state) },
    })];
  },
});
