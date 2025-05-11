class MhdBaCard extends HTMLElement {
	_cardBuilt;
	_cardBuiltResolve;
	_itemCount = 0;

	// Return the card editor for configuration in the UI
	static getConfigElement() {
		const editor = document.createElement('mhd-ba-card-editor');
		return editor;
	}

	// Return the card configuration element for validation
	static getStubConfig() {
		return {
			entity: '',
			title: null
		};
	}

    set hass(hass) {
        this._hass = hass;

        // Set default title from entity if needed
        if ((this.title === null || this.title === ''|| this.title === 'null') && this._primaryEntity && hass.states[this._primaryEntity]) {
            this.title = hass.states[this._primaryEntity].attributes.friendly_name || this._primaryEntity;
        }

        if (!this.tableDiv) {
            const card = document.createElement('ha-card');

            var header = document.createElement('div');
            header.className = "card-header";
            header.appendChild(document.createTextNode(this.title));
            card.appendChild(header);

            this.tableDiv = document.createElement('div');
            this.tableDiv.id = "mhdBaCard";
            card.appendChild(this.tableDiv);
            this.appendChild(card);
            this.initTable(this.tableDiv);
        } else {
            this.updateTable();
        }
    }

    setConfig(config) {
        this.entities = [];
        this.entities_names = [];

        this._config = config;

        // Use entity's friendly name as default title if no title provided
        if (config.title === null || config.title === '' || config.title === undefined) {
            this.title = null; // Will be set in hass() when entity data is available
        } else {
            this.title = config.title;
        }

		this._cardBuilt = new Promise(
		  (resolve) => (this._cardBuiltResolve = resolve)
		);

        if (config.entity) {
            this.entities.push(config.entity);
            // Make sure we store the primary entity for use in getData
            this._primaryEntity = config.entity;
        }

        if (config.entities) {
            config.entities.forEach((entity) => {
                if (typeof entity === 'string') {
                    this.entities.push(entity);
                } else {
                    this.entities.push(entity.entity_id);
                    this.entities_names[entity.entity_id] = entity.name;
                }
            });

            // If no primary entity set yet but we have entities, use the first one
            if (!this._primaryEntity && this.entities.length > 0) {
                this._primaryEntity = this.entities[0];
            }
        }
    }

    async initTable(ele) {
        // Create the table structure only once
        this.createTableStructure(ele);

        // Initial population of rows
        var data = await this.getData();
        this.updateTableRows(data);

		this._cardBuiltResolve?.();
    }

    async updateTable() {
        var data = await this.getData(true);
        this.updateTableRows(data);
    }

    async getData(forceUpdate) {
        // Use primary entity or fall back to first in config.entity
        const entityId = this._primaryEntity || this._config?.entity;

        if (!entityId || !this._hass || !this._hass.states[entityId]) {
            console.warn("MHD BA Card: Entity not found or not ready", entityId);
            return [];
        }

        const entityData = this._hass.states[entityId];
        if (!entityData.attributes || !entityData.attributes["departures"]) {
            console.warn("MHD BA Card: No departures data available");
            return [];
        }

        return entityData.attributes["departures"];
    }

	async getCardSize() {
		await this._cardBuilt;
		return this._itemCount + 4;
	}

    createTableStructure(parentElement) {
        // Create the table structure only once
        var tbl = document.createElement('table');
        tbl.style.width = '100%';
        tbl.style.padding = '10px';
        tbl.setAttribute('border', '0');

        // Create table header
        var thead = document.createElement('thead');
        var headerRow = document.createElement('tr');

        var lineHeader = document.createElement('th');
        lineHeader.appendChild(document.createTextNode('Line'));
        lineHeader.style.fontWeight = "bold";
        headerRow.appendChild(lineHeader);

        var destinationHeader = document.createElement('th');
        destinationHeader.appendChild(document.createTextNode('Destination'));
        destinationHeader.style.fontWeight = "bold";
        headerRow.appendChild(destinationHeader);

        var departuresHeader = document.createElement('th');
        departuresHeader.appendChild(document.createTextNode('Departure in'));
        departuresHeader.style.fontWeight = "bold";
        headerRow.appendChild(departuresHeader);

        thead.appendChild(headerRow);
        tbl.appendChild(thead);

        // Create tbody to hold the data rows
        var tbdy = document.createElement('tbody');
        tbdy.id = "mhdBaTableBody";
        tbl.appendChild(tbdy);

        // Save references for later use
        this.table = tbl;
        this.tableBody = tbdy;

        // Append to parent
        parentElement.appendChild(tbl);
    }

    updateTableRows(data) {
        // Clear existing rows first
        while (this.tableBody.firstChild) {
            this.tableBody.removeChild(this.tableBody.firstChild);
        }

        // Add new rows
        this._itemCount = data.length;
        for (const dataRow of data) {
            var tr = document.createElement('tr');
            var td1 = document.createElement('td');
            var td2 = document.createElement('td');
            var td3 = document.createElement('td');

            td1.appendChild(document.createTextNode(dataRow.line));
            tr.appendChild(td1);

            td3.appendChild(document.createTextNode(dataRow.destination));
            tr.appendChild(td3);

            td2.appendChild(document.createTextNode(dataRow.minutes_until_departure + " min"));
            tr.appendChild(td2);

            this.tableBody.appendChild(tr);
        }
    }
}

// Define the card editor
customElements.define('mhd-ba-card', MhdBaCard);

// Editor implementation for the custom card
class MhdBaCardEditor extends HTMLElement {
    constructor() {
        super();
        this._config = {
            entity: '',
            title: null
        };
        this._hass = null;
        this.attachShadow({ mode: 'open' });
        this._rendered = false;
    }

    setConfig(config) {
        // Store the config - this is called by Lovelace when editing an existing card
        this._config = { ...config };

        if (this._rendered) {
            // If already rendered, just update field values
            this._updateFieldValues();
        } else {
            // Otherwise do initial render
            this.render();
        }
    }

    get editor() {
        return this.shadowRoot.getElementById('editor');
    }

    render() {
        if (!this.shadowRoot) return;

        // Only create the UI once to prevent focus loss
        if (this._rendered) {
            this._updateFieldValues();
            return;
        }

        // Create editor wrapper
        const wrapper = document.createElement('div');
        wrapper.id = 'editor';
        wrapper.style.padding = '8px';

        // Create title field
        const titleField = document.createElement('ha-textfield');
        titleField.id = 'title-field';
        titleField.label = "Title";
        titleField.value = this._config.title || '';
        titleField.configValue = 'title';
        titleField.style.display = 'block';
        titleField.style.width = '100%';
        titleField.style.marginBottom = '16px';
        titleField.addEventListener('input', this._valueChanged.bind(this));
        wrapper.appendChild(titleField);

        // Create entity field - use a dropdown
        const entityRow = document.createElement('div');
        entityRow.className = 'row';
        entityRow.style.marginTop = '16px';

        // Create entity selector
        const entitySelect = document.createElement('select');
        entitySelect.id = 'entity-field';
        entitySelect.style.display = 'block';
        entitySelect.style.width = '100%';
        entitySelect.style.height = '40px';
        entitySelect.configValue = 'entity';
        entitySelect.addEventListener('change', this._valueChanged.bind(this));

        // Add a label
        const entityLabel = document.createElement('div');
        entityLabel.textContent = 'Entity';
        entityLabel.style.marginBottom = '8px';
        entityLabel.style.fontWeight = 'bold';

        entityRow.appendChild(entityLabel);
        entityRow.appendChild(entitySelect);

        // Add help text
        const helpText = document.createElement('div');
        helpText.style.color = 'var(--secondary-text-color)';
        helpText.style.fontSize = '12px';
        helpText.style.marginTop = '4px';
        helpText.textContent = 'Select the sensor entity for MHD BA departures';
        entityRow.appendChild(helpText);

        wrapper.appendChild(entityRow);
        this.shadowRoot.appendChild(wrapper);

        this._rendered = true;

        // If we have hass data, populate the entity dropdown
        if (this._hass) {
            this._updateEntityList();
        }

        // Make sure fields are initialized with current values
        this._updateFieldValues();
    }

    _updateEntityList() {
        const entitySelect = this.shadowRoot.getElementById('entity-field');
        if (!entitySelect || !this._hass) return;

        // Clear existing options
        while (entitySelect.firstChild) {
            entitySelect.removeChild(entitySelect.firstChild);
        }

        // Add empty option
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = '-- Select sensor --';
        entitySelect.appendChild(emptyOption);

        // Get all sensor entities
        const sensorEntities = Object.keys(this._hass.states)
            .filter(entityId => entityId.startsWith('sensor.'))
            .sort();

        // Add options for each sensor entity
        for (const entityId of sensorEntities) {
            const option = document.createElement('option');
            option.value = entityId;

            // Get friendly name if available
            const entity = this._hass.states[entityId];
            const friendlyName = entity.attributes && entity.attributes.friendly_name
                ? entity.attributes.friendly_name
                : entityId;

            option.textContent = `${friendlyName} (${entityId})`;
            entitySelect.appendChild(option);
        }
    }

    _updateFieldValues() {
        // Update field values without recreating the DOM elements
        const titleField = this.shadowRoot.getElementById('title-field');
        const entityField = this.shadowRoot.getElementById('entity-field');

        if (titleField) {
            titleField.value = this._config.title || '';
        }

        if (entityField) {
            // Update the selected entity in dropdown
            const selectedEntityId = this._config.entity || '';

            // First ensure we have all entity options
            if (this._hass && entityField.tagName === 'SELECT') {
                // Only repopulate if needed
                if (entityField.options.length <= 1) {
                    this._updateEntityList();
                }

                // Set the selected option
                for (let i = 0; i < entityField.options.length; i++) {
                    if (entityField.options[i].value === selectedEntityId) {
                        entityField.selectedIndex = i;
                        break;
                    }
                }
            }
        }
    }

    _valueChanged(ev) {
        if (!this._config || !this.shadowRoot) return;

        const target = ev.target;
        const configValue = target.configValue;

        if (!configValue) return;

        // Update the config without triggering a render
        this._config = {
            ...this._config,
            [configValue]: target.value
        };

        // Notify Lovelace of the changed config
        const event = new CustomEvent('config-changed', {
            detail: { config: this._config },
            bubbles: true,
            composed: true,
        });
        this.dispatchEvent(event);
    }

    set hass(hass) {
        this._hass = hass;

        // Update entity list when hass is updated
        if (this._rendered) {
            this._updateEntityList();
            this._updateFieldValues();
        } else {
            // Initial render if not done yet
            this.render();
        }
    }

    connectedCallback() {
        if (!this._rendered) {
            this.render();
        }
    }
}

// Register the editor component BEFORE the card component registers with customCards
customElements.define('mhd-ba-card-editor', MhdBaCardEditor);

// Register card with Lovelace
window.customCards = window.customCards || [];
window.customCards.push({
  type: "mhd-ba-card",
  name: "MHD BA Departures",
  description: "A card that shows public transport departures"
});
