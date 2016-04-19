import csv
import json

ident = lambda x: x
parsers = {
    'parent': ident,
    'labelFor': ident,
    'dataType': ident,
    'dimensionType': ident,
    'classificationType': ident,
    'uniqueIdentifier': lambda x: x=='y',
}

if __name__ == "__main__":
    infile = iter(csv.reader(open('openspending-types.csv')))
    header = next(infile)
    prev_types = []
    types = {}
    for row in infile:
        idx = 0
        type_name = None
        for hdr, val in zip(header,row):
            val = val.strip()
            if len(val)>0:
                if hdr == 'type':
                    if len(prev_types) == idx:
                        prev_types.append(val)
                    elif len(prev_types) < idx:
                        print(prev_types, idx, row)
                        assert(False);
                    else:
                        prev_types[idx] = val
                        prev_types = prev_types[:idx+1]
                else:
                    if type_name is None:
                        type_name = ':'.join(prev_types)
                    types.setdefault(type_name, {})[hdr] = parsers[hdr](val)
            idx += 1
    json.dump(types, open('src/os-types.json','w'), indent=2, sort_keys=True)
