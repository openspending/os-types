'use strict';

module.exports =
{
  osTypes: {
    value: {
      options: [
        {
          name: 'currency',
          title: 'Currency',
          values: []
        },
        {
          name: 'factor',
          title: 'Factor',
          type: 'number'
        },
        {
          name: 'direction',
          title: 'Direction',
          values: [
            {name: 'Expenditure', value: 'expenditure'},
            {name: 'Revenue', value: 'revenue'}
          ]
        },
        {
          name: 'phase',
          title: 'Phase',
          values: [
            {name: 'Proposed', value: 'proposed'},
            {name: 'Approved', value: 'approved'},
            {name: 'Adjusted', value: 'adjusted'},
            {name: 'Executed', value: 'executed'}
          ]
        }
      ]
    }
  },
  dataTypes: {
    datetime: {
      options: [
        {
          name: 'format',
          title: 'Format',
          defaultValue: '%Y-%m-%dT%H:%M:%SZ'
        }
      ]
    },
    date: {
      options: [
        {
          name: 'format',
          title: 'Format',
          defaultValue: '%Y-%m-%d'
        }
      ]
    },
    time: {
      options: [
        {
          name: 'format',
          title: 'Format',
          defaultValue: '%H:%M:%S'
        }
      ]
    },
    number: {
      options: [
        {
          name: 'decimalChar',
          title: 'Decimal Separator',
          defaultValue: '.',
          trim: "false"
        },
        {
          name: 'groupChar',
          title: 'Grouping Character',
          defaultValue: ',',
          trim: "false"
        }
      ]
    }
  }
};
