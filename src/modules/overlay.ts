import { config } from "../../package.json";
import { getString } from "../utils/locale";

const ANNOTATIONS_COUNT_COLUMN_ID = "annotationscount";
export default class ZoteroAnnotationsCount {
	annotationsCountColumnId?: string | false;

	constructor() {
		void this.addAnnotationsCountColumn();
	}

	public unload() {
		void this.removeAnnotationsCountColumn();
	}

	async addAnnotationsCountColumn() {
		this.annotationsCountColumnId =
			await Zotero.ItemTreeManager.registerColumns({
				dataKey: ANNOTATIONS_COUNT_COLUMN_ID,
				label: getString("annotations-column-name"),
				pluginID: config.addonID,
				dataProvider: (item: Zotero.Item, dataKey: string) => {
					return this.formatAnnotationsCounts(
						this.getItemAnnotationsCount(item),
					);
				},
				zoteroPersist: ["width", "hidden", "sortDirection"],
			});
	}

	async removeAnnotationsCountColumn() {
		if (this.annotationsCountColumnId) {
			await Zotero.ItemTreeManager.unregisterColumns(
				this.annotationsCountColumnId,
			);
			this.annotationsCountColumnId = undefined;
		}
	}

	// copied from Zotero
	isAttachmentWithExtractableAnnotations(item: Zotero.Item) {
		// For now, consider all PDF attachments eligible, since we want to extract external
		// annotations in unprocessed files if present
		// item.isPDFAttachment() && item.getAnnotations().some(x => x.annotationType != 'ink');
		return (
			item.isPDFAttachment() ||
			((item.isEPUBAttachment() || item.isSnapshotAttachment()) &&
				item.getAnnotations().length)
		);
	}

	formatAnnotationsCounts(count: number) {
		return count != -1 ? count.toString() : "";
	}

	getItemAnnotationsCount(item: Zotero.Item) {
		if (item.isRegularItem()) {
			// it's an item that could have multiple attachments
			// sum all their annotation counts
			return Zotero.Items.get(item.getAttachments())
				.filter((item) =>
					this.isAttachmentWithExtractableAnnotations(item),
				)
				.map((attachment) => attachment.getAnnotations().length)
				.reduce((sum, numAnnotations) => sum + numAnnotations, 0);
		} else if (this.isAttachmentWithExtractableAnnotations(item)) {
			// it's an attachment - how many annotations does it have
			return item.getAnnotations().length;
		} else {
			return -1;
		}
	}
}
