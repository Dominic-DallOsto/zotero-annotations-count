import { config } from "../../package.json";
import { getString } from "../utils/locale";
import {
	getPref,
	initialiseDefaultPref,
	getPrefGlobalName,
} from "../utils/prefs";

const ANNOTATIONS_COUNT_COLUMN_ID = "annotationscount";
const ANNOTATIONS_COUNT_COLUMN_FORMAT_SHOW_ICON_PREF =
	"annotationscount-show-icon";
const DONT_SHOW_ZERO_COUNTS_PREF = "annotationscount-hide-zeros";

export default class ZoteroAnnotationsCount {
	annotationsCountColumnId?: string | false;
	preferenceUpdateObservers?: symbol[];

	constructor() {
		this.initialiseDefaultPreferences();
		this.addAnnotationsCountColumn();
		this.addPreferencesMenu();
		this.addPreferenceUpdateObservers();
	}

	public unload() {
		this.removeAnnotationsCountColumn();
		this.removePreferencesMenu();
		this.removePreferenceUpdateObservers();
	}

	initialiseDefaultPreferences() {
		initialiseDefaultPref(
			ANNOTATIONS_COUNT_COLUMN_FORMAT_SHOW_ICON_PREF,
			false,
		);
		initialiseDefaultPref(
			ANNOTATIONS_COUNT_COLUMN_FORMAT_SHOW_ICON_PREF,
			false,
		);
	}

	addAnnotationsCountColumn() {
		this.annotationsCountColumnId = Zotero.ItemTreeManager.registerColumn({
			dataKey: ANNOTATIONS_COUNT_COLUMN_ID,
			// If we just want to show the icon, overwrite the label with htmlLabel (#1)
			htmlLabel: getPref(ANNOTATIONS_COUNT_COLUMN_FORMAT_SHOW_ICON_PREF)
				? `<span class="icon icon-css icon-16" style="background: url(chrome://${config.addonRef}/content/icons/favicon.png) content-box no-repeat center/contain;" />`
				: undefined,
			label: getString("annotations-column-name"),
			pluginID: config.addonID,
			dataProvider: (item: Zotero.Item, dataKey: string) => {
				return this.getItemAnnotationsCount(item).toString();
			},
			renderCell: (
				index: number,
				data: string,
				column: { className: string },
			) => {
				const cell = this.createSpanElement(
					`cell ${column.className}`,
					"",
				);
				const text = this.createSpanElement(
					"cell-text",
					this.formatAnnotationsCount(data),
				);
				cell.append(text);

				return cell;
			},
			zoteroPersist: ["width", "hidden", "sortDirection"],
		});
	}

	createSpanElement(className: string, innerText: string) {
		const span = document.createElementNS(
			"http://www.w3.org/1999/xhtml",
			"span",
		);
		span.className = className;
		span.innerText = innerText;
		return span;
	}

	removeAnnotationsCountColumn() {
		if (this.annotationsCountColumnId) {
			Zotero.ItemTreeManager.unregisterColumn(
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

	/**
	 * Count is either:
	 *   -1 -> this is a note or other item that can't have annotations nor attachments, show nothing;
	 *    0 -> show 0 unless the set not to in preferences;
	 * else -> show the number
	 */
	formatAnnotationsCount(count: string) {
		if (
			count == "-1" ||
			(count == "0" && getPref(DONT_SHOW_ZERO_COUNTS_PREF))
		) {
			return "";
		} else {
			return count;
		}
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

	addPreferencesMenu() {
		const prefOptions = {
			pluginID: config.addonID,
			src: rootURI + "chrome/content/preferences.xhtml",
			label: getString("pref-title"),
			image: `chrome://${config.addonRef}/content/icons/favicon.png`,
			defaultXUL: true,
		};
		void Zotero.PreferencePanes.register(prefOptions);
	}

	removePreferencesMenu() {
		Zotero.PreferencePanes.unregister(config.addonID);
	}

	addPreferenceUpdateObservers() {
		this.preferenceUpdateObservers = [
			Zotero.Prefs.registerObserver(
				getPrefGlobalName(
					ANNOTATIONS_COUNT_COLUMN_FORMAT_SHOW_ICON_PREF,
				),
				async (value: boolean) => {
					this.removeAnnotationsCountColumn();
					this.addAnnotationsCountColumn();
				},
				true,
			),
			Zotero.Prefs.registerObserver(
				getPrefGlobalName(DONT_SHOW_ZERO_COUNTS_PREF),
				async (value: boolean) => {
					this.removeAnnotationsCountColumn();
					this.addAnnotationsCountColumn();
				},
				true,
			),
		];
	}

	removePreferenceUpdateObservers() {
		if (this.preferenceUpdateObservers) {
			for (const preferenceUpdateObserverSymbol of this
				.preferenceUpdateObservers) {
				Zotero.Prefs.unregisterObserver(preferenceUpdateObserverSymbol);
			}
			this.preferenceUpdateObservers = undefined;
		}
	}
}
